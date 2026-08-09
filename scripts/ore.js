// ore.js - a simple One-Roll Engine (ORE) implementation for Foundry

// This file implements the core rolling behaviour you requested in a way that can
// be connected to the rest of the Foundry system. It handles:
// - dice pool building (skill + modifiers + hard + wiggle)
// - cap of 10 dice total
// - hard dice and wiggle dice (wiggle dice can be set by player after roll)
// - spray, slow, area, burn handling for weapons
// - ammo consumption and simple magazine support
// - conversion of height->location using your mapping
// - damage calculation: base weapon damage + width

window.godlike_ore_roll = async function({actor, weapon, skillPool=0, mod=0, hard=0, wiggle=0, sprayOn=false, areaExtra=0}){
  // Read weapon data (when Item object passed, else accept plain object)
  const w = weapon?.data ? weapon.data.data : weapon;
  const baseDamage = Number(w.damage||w.baseDamage||0);
  const magCurrent = Number(w.magCurrent||w.magCurrent||0);
  const magCap = Number(w.magCap||w.magCap||0);
  const sprayVal = Number(w.spray||0);
  const slowVal = Number(w.slow||0);
  const areaVal = Number(w.area||0) || areaExtra;
  // Burn fields: a toggle and an X value; optional note
  const burnEnabled = Boolean(w.burnEnabled || (w.burn && w.burn.enabled));
  const burnValue = Number(w.burnValue || (w.burn && w.burn.x) || 0);
  const burnNote = String(w.burnNote || (w.burn && w.burn.note) || '');

  // Build dice pool
  const skill = Number(skillPool||0);
  let pool = Math.max(0, skill + Number(mod||0));
  // include hard & wiggle
  hard = Math.max(0, Number(hard||0));
  wiggle = Math.max(0, Number(wiggle||0));
  // include spray if requested and weapon supports it
  if (sprayOn && sprayVal>0) pool += sprayVal;
  
  // cap total to 10, preserve hard/wiggle preference by trimming pool first
  const totalRequested = pool + hard + wiggle;
  if(totalRequested > 10){
    const overflow = totalRequested - 10;
    pool = Math.max(0, pool - overflow);
  }
  const totalDice = pool + hard + wiggle;

  // Ammo check and consumption
  let ammoUsed = 1;
  if(sprayOn && sprayVal>0){ ammoUsed = pool; }
  // If not enough ammo, reduce dice (for spray) or block
  let actualAmmoAvailable = magCurrent;
  if(actualAmmoAvailable < ammoUsed){
    if(sprayOn && pool>0){
      const deficit = ammoUsed - actualAmmoAvailable;
      pool = Math.max(0, pool - deficit);
      ammoUsed = Math.min(ammoUsed, actualAmmoAvailable);
    } else if(actualAmmoAvailable <= 0){
      ui.notifications.warn(`${weapon?.name || w.name} has no ammo to fire`);
      return {error:'no-ammo'};
    }
  }

  // perform the dice rolls
  const rolls = [];
  for(let i=0;i<pool;i++) rolls.push({value:1+Math.floor(Math.random()*10),type:'normal'});
  for(let i=0;i<hard;i++) rolls.push({value:1+Math.floor(Math.random()*10),type:'hard'});
  for(let i=0;i<wiggle;i++) rolls.push({value:1+Math.floor(Math.random()*10),type:'wiggle'});

  // Allow wiggle dice manual assignment after roll: ask user which value for each wiggle
  for(const d of rolls.filter(r=>r.type==='wiggle')){
    const choice = await new Promise(resolve=>{
      const val = Number(prompt('Pick value for a Wiggle die (1-10):', String(d.value))) || d.value;
      resolve(val);
    });
    d.value = Number(choice);
  }

  // Build counts
  const counts = {};
  for(const d of rolls){ counts[d.value] = (counts[d.value]||0) + 1; }
  // For spray: each distinct matching set should be treated separately
  const matches = Object.entries(counts).map(([val,cnt])=>({height: Number(val), width: cnt})).sort((a,b)=> b.width - a.width || b.height - a.height);

  // If sprayOn, we may create multiple damage results per match
  const results = [];
  for(const m of matches){
    const damage = baseDamage + m.width; // per your rule
    results.push({height:m.height,width:m.width,damage,location:mapHeightToLocation(m.height)});
  }

  // Handle area(X): roll X dice separately and report locations
  const areaRolls = [];
  if(areaVal>0){
    for(let i=0;i<areaVal;i++){
      const v = 1+Math.floor(Math.random()*10);
      areaRolls.push({value:v,location:mapHeightToLocation(v)});
    }
  }

  // Decrement slow counters on actor weapons automatically (if actor provided and has items)
  if(actor && actor.items){
    // find other weapons and decrement their slowCounter if >0
    for(const it of actor.items.filter(i=>i.type==='weapon')){
      const sc = Number(it.data.data.slowCounter||0);
      if(sc>0){
        it.update({'data.slowCounter': Math.max(0, sc-1)});
      }
    }
    // set slow on this weapon
    if(slowVal>0){
      if(weapon.update) await weapon.update({'data.slowCounter': slowVal});
      else w.slowCounter = slowVal;
    }
    // deduct ammo from the weapon's magazine
    if(weapon.update){
      const newMag = Math.max(0, (Number(w.magCurrent||0) - ammoUsed));
      await weapon.update({'data.magCurrent': newMag});
    } else {
      w.magCurrent = Math.max(0, (Number(w.magCurrent||0) - ammoUsed));
    }
  }

  // Create a chat message summarizing the roll
  const chatContent = buildChatHTML({actor,weapon,w,rolls,matches,results,areaRolls,ammoUsed, burnEnabled, burnValue, burnNote});
  ChatMessage.create({user:game.user.id, speaker:{actor:actor?.id||null}, content:chatContent});

  return {rolls,matches,results,areaRolls,ammoUsed};
}

function mapHeightToLocation(h){
  // height mapping you supplied:
  // 10 = Head, 7-9 = Torso, 5-6 = Left arm, 3-4 = Right arm, 2 = left leg, 1 = right leg
  if(h==10) return 'Head';
  if(h>=7 && h<=9) return 'Torso';
  if(h>=5 && h<=6) return 'Left arm';
  if(h>=3 && h<=4) return 'Right arm';
  if(h==2) return 'Left leg';
  return 'Right leg';
}

function buildChatHTML({actor,weapon,w,rolls,matches,results,areaRolls,ammoUsed, burnEnabled, burnValue, burnNote}){
  const header = `<h3>ORE Attack: ${weapon?.name||w?.name||'Weapon'}</h3>`;
  const rollLine = `<div><strong>Dice rolls:</strong> ${rolls.map(r=>r.value+'('+r.type[0]+')').join(', ')}</div>`;
  const matchesHTML = `<div><strong>Matches:</strong> ${matches.map(m=>`${m.width}x ${m.height}`).join(', ')}</div>`;
  // include burn text in the damage results when burnEnabled
  const resHTML = `<div><strong>Damage results:</strong><ul>${results.map(r=>`<li>${r.damage} damage to ${r.location} (height ${r.height}, width ${r.width})${burnEnabled?(' — Burn: '+burnValue):''}</li>`).join('')}</ul></div>`;
  const areaHTML = areaRolls.length? `<div><strong>Area rolls (locations):</strong> ${areaRolls.map(a=>`${a.value}->${a.location}`).join(', ')}</div>`:'';
  const burnHTML = burnNote ? `<div><strong>Burn note:</strong> ${burnNote}</div>` : '';
  const ammoHTML = `<div><em>Ammo used: ${ammoUsed}. Remaining (if tracked on item): ${w.magCurrent||'N/A'}</em></div>`;
  return header + rollLine + matchesHTML + resHTML + areaHTML + burnHTML + ammoHTML;
}
