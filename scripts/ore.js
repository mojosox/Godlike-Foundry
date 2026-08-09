// ore.js - updated to use Foundry Roll API and Dice3D for visuals

window.godlike_ore_roll = async function({actor, weapon, skillPool=0, mod=0, hard=0, wiggleCount=0, wiggleValues=[], sprayOn=false, areaExtra=0}){
  // weapon may be an Item instance or plain data
  const itemObj = weapon?.data ? weapon : null;
  const w = itemObj ? weapon.data.data : weapon || {};

  const baseDamage = Number(w.damage||w.baseDamage||0);
  const magCurrent = Number(w.magCurrent||w.magCurrent||0);
  const magCap = Number(w.magCap||w.magCap||0);
  const sprayVal = Number(w.spray||0);
  const slowVal = Number(w.slow||0);
  const areaVal = Number(w.area||0) || areaExtra;
  const burnEnabled = Boolean(w.burnEnabled || false);
  const burnValue = Number(w.burnValue || 0);
  const burnNote = String(w.burnNote || '');

  // Build base pool (attribute/skill contributions should be passed in skillPool param)
  let poolBase = Math.max(0, Number(skillPool||0) + Number(mod||0));
  if(sprayOn && sprayVal>0) poolBase += Number(sprayVal);

  // Ensure hard + wiggle are not added on top of pool; they must be <= pool
  let hardCount = Math.max(0, Number(hard||0));
  let wigCount = Math.max(0, Number(wiggleCount||0));
  if(hardCount + wigCount > poolBase){
    const overflow = hardCount + wigCount - poolBase;
    // Trim wiggle first
    const trimWig = Math.min(overflow, wigCount);
    wigCount -= trimWig;
    const remaining = overflow - trimWig;
    hardCount = Math.max(0, hardCount - remaining);
  }

  const normalDice = Math.max(0, poolBase - hardCount - wigCount);
  const totalDice = normalDice + hardCount + wigCount;

  // Enforce absolute cap of 10
  if(totalDice > 10){
    // trim normalDice down first (preserve hard/wiggle as requested)
    const overflow = totalDice - 10;
    const newNormal = Math.max(0, normalDice - overflow);
    const removed = normalDice - newNormal;
    normalDice = newNormal; // eslint-disable-line no-undef
  }

  // Determine ammo needed
  let ammoNeeded = 1;
  if(sprayOn && sprayVal>0){ ammoNeeded = poolBase; }

  // Check magazine availability (if Item present, update on it)
  let actualMag = magCurrent;
  if(itemObj){ actualMag = Number(itemObj.data.data.magCurrent||0); }
  if(actualMag < ammoNeeded){
    ui.notifications.warn(`Not enough ammo in ${weapon.name || w.name}; needs ${ammoNeeded}, has ${actualMag}`);
    // For now, block the firing
    return {error:'no-ammo'};
  }

  // Roll normal dice via Roll API (so Dice3D can animate them)
  let normalRoll = null;
  if(normalDice > 0){
    const formula = `${normalDice}d10`;
    normalRoll = await new Roll(formula).evaluate({async:true});
    // Show 3D animation if available
    if(game.dice3d) await game.dice3d.showForRoll(normalRoll, game.user, true);
  }

  // Build final rolls array: hard dice (value 10), wiggle dice (values from wiggleValues if provided, else random), normal dice (from normalRoll results)
  const finalRolls = [];
  for(let i=0;i<hardCount;i++) finalRolls.push({value:10, type:'hard'});

  // Wiggle values: if provided array length < wigCount, generate random for missing
  for(let i=0;i<wigCount;i++){
    const val = (Array.isArray(wiggleValues) && wiggleValues[i] !== undefined) ? Number(wiggleValues[i]) : (1 + Math.floor(Math.random()*10));
    finalRolls.push({value: val, type: 'wiggle'});
  }

  if(normalRoll){
    // extract numeric values
    const results = normalRoll.terms[0].results.map(r => r.result);
    for(const v of results) finalRolls.push({value:v, type:'normal'});
  }

  // Now compute matches (group by face value)
  const counts = {};
  for(const d of finalRolls) counts[d.value] = (counts[d.value]||0) + 1;
  const matches = Object.entries(counts).map(([val,cnt]) => ({height: Number(val), width: cnt})).sort((a,b)=> b.width - a.width || b.height - a.height);

  // Build damage results: if Spray was used produce separate lines for all matches; otherwise choose best match
  let damageResults = [];
  if(sprayOn && matches.length > 1){
    for(const m of matches){
      const dmg = baseDamage + m.width;
      damageResults.push({height: m.height, width: m.width, damage: dmg, location: mapHeightToLocation(m.height)});
    }
  } else {
    if(matches.length>0){
      const best = matches[0];
      const dmg = baseDamage + best.width;
      damageResults.push({height: best.height, width: best.width, damage: dmg, location: mapHeightToLocation(best.height)});
    } else {
      // no matches: treat highest die as height with width 1 (conservative approach)
      const highest = finalRolls.reduce((a,b)=> a.value>b.value?a:b);
      const dmg = baseDamage + 1;
      damageResults.push({height: highest.value, width: 1, damage: dmg, location: mapHeightToLocation(highest.value)});
    }
  }

  // Area rolls
  const areaResults = [];
  if(areaVal>0){
    const aRoll = await new Roll(`${areaVal}d10`).evaluate({async:true});
    if(game.dice3d) await game.dice3d.showForRoll(aRoll, game.user, true);
    const avals = aRoll.terms[0].results.map(r=>r.result);
    for(const av of avals) areaResults.push({value: av, location: mapHeightToLocation(av)});
  }

  // Deduct ammo and apply slow cooldown on item if present
  if(itemObj){
    const newMag = Math.max(0, Number(itemObj.data.data.magCurrent||0) - ammoNeeded);
    await itemObj.update({'data.magCurrent': newMag});
    if(slowVal>0) await itemObj.update({'data.slowCounter': slowVal});
  }

  // Decrement slow counters automatically for the actor's other weapons
  if(actor && actor.items){
    for(const it of actor.items.filter(i=>i.type==='weapon')){
      const sc = Number(it.data.data.slowCounter||0);
      if(sc>0){ await it.update({'data.slowCounter': Math.max(0, sc-1)}); }
    }
  }

  // Build chat message including Burn info per damage line
  const chatContent = buildChatHTML({actor, weapon: itemObj || w, finalRolls, matches, damageResults, areaResults, ammoUsed, burnEnabled, burnValue, burnNote});
  ChatMessage.create({user: game.user.id, speaker: ChatMessage.getSpeaker({actor: actor}), content: chatContent});

  return {finalRolls, matches, damageResults, areaResults};
}

function mapHeightToLocation(h){
  if(h==10) return 'Head';
  if(h>=7 && h<=9) return 'Torso';
  if(h>=5 && h<=6) return 'Left arm';
  if(h>=3 && h<=4) return 'Right arm';
  if(h==2) return 'Left leg';
  return 'Right leg';
}

function buildChatHTML({actor, weapon, finalRolls, matches, damageResults, areaResults, ammoUsed, burnEnabled, burnValue, burnNote}){
  const header = `<h3>ORE Attack: ${weapon?.name || weapon?.data?.name || 'Weapon'}</h3>`;
  const rollLine = `<div><strong>Dice rolled (${finalRolls.length}):</strong> ${finalRolls.map(r=>`${r.value}${r.type==='hard'?'.H':r.type==='wiggle'?'.W':''}`).join(', ')}</div>`;
  const matchesHTML = `<div><strong>Matches:</strong> ${matches.map(m=>`${m.width}x ${m.height}`).join(', ')}</div>`;
  const resultHTML = `<div><strong>Damage results:</strong><ul>${damageResults.map(d=>`<li>${d.damage} damage to ${d.location} (height ${d.height}, width ${d.width})${burnEnabled?(' — Burn: '+burnValue):''}</li>`).join('')}</ul></div>`;
  const areaHTML = areaResults.length ? `<div><strong>Area:</strong> ${areaResults.map(a=>`${a.value}->${a.location}`).join(', ')}</div>` : '';
  const burnHTML = burnNote ? `<div><strong>Burn note:</strong> ${burnNote}</div>` : '';
  const ammoHTML = `<div><em>Ammo used: ${ammoUsed}</em></div>`;
  return header + rollLine + matchesHTML + resultHTML + areaHTML + burnHTML + ammoHTML;
}
