// scripts/godlike.js - Actor sheet registration, Willpower handling, and Combat turn hook

Hooks.once('init', ()=>{
  console.log('Godlike | Initializing Godlike system (Willpower support + combat integration)');

  class GodlikeActorSheet extends ActorSheet {
    static get defaultOptions(){
      return foundry.utils.mergeObject(super.defaultOptions, {
        classes:['godlike','sheet','actor'],
        template: 'systems/godlike-foundry/templates/sheets/godlike-sheet.html',
        width: 980,
        height: 760,
        tabs: [{navSelector: ".tabs", contentSelector: ".sheet-body", initial: "attributes"}]
      });
    }

    getData(){
      const data = super.getData();
      data.system = data.actor?.system ?? data.actor?.data?.data ?? {};
      return data;
    }

    activateListeners(html){
      super.activateListeners(html);

      // Normalize html to jQuery wrapper for compatibility in Foundry v14 render flows
      const $html = (typeof jQuery !== 'undefined' && html instanceof jQuery) ? html : $(html);

      // Willpower controls
      $html.find('.will-decr').on('click', async ev => {
        ev.preventDefault();
        const cur = Number(this.actor?.system?.willCurrent ?? this.actor?.data?.data?.willCurrent ?? 0);
        const newVal = Math.max(0, cur - 1);
        await this.actor.update({'system.willCurrent': newVal, 'data.willCurrent': newVal});
        this._refreshWillUI($html, newVal);
      });

      $html.find('.will-incr').on('click', async ev => {
        ev.preventDefault();
        const base = Number(this.actor?.system?.baseWill ?? this.actor?.data?.data?.baseWill ?? 0);
        const cur = Number(this.actor?.system?.willCurrent ?? this.actor?.data?.data?.willCurrent ?? base);
        const newVal = Math.min(base, cur + 1);
        await this.actor.update({'system.willCurrent': newVal, 'data.willCurrent': newVal});
        this._refreshWillUI($html, newVal);
      });

      $html.find('.will-current-input').on('change', async ev => {
        const val = Number(ev.currentTarget.value || 0);
        const base = Number(this.actor?.system?.baseWill ?? this.actor?.data?.data?.baseWill ?? 0);
        const clamped = Math.max(0, Math.min(base, val));
        await this.actor.update({'system.willCurrent': clamped, 'data.willCurrent': clamped});
        this._refreshWillUI($html, clamped);
      });

      $html.find('.base-will-input').on('change', async ev => {
        const baseVal = Math.max(0, Number(ev.currentTarget.value || 0));
        const cur = Number(this.actor?.system?.willCurrent ?? this.actor?.data?.data?.willCurrent ?? 0);
        const newCur = Math.min(cur, baseVal);
        await this.actor.update({'system.baseWill': baseVal, 'system.willCurrent': newCur, 'data.baseWill': baseVal, 'data.willCurrent': newCur});
        this._refreshWillUI($html, newCur);
      });

      $html.find('.will-slider').on('input', async ev => {
        const val = Number(ev.currentTarget.value || 0);
        $html.find('.will-display').text(val);
      });

      $html.find('.will-slider').on('change', async ev => {
        const val = Number(ev.currentTarget.value || 0);
        const base = Number(this.actor?.system?.baseWill ?? this.actor?.data?.data?.baseWill ?? 0);
        const clamped = Math.max(0, Math.min(base, val));
        await this.actor.update({'system.willCurrent': clamped, 'data.willCurrent': clamped});
        this._refreshWillUI($html, clamped);
      });
    }

    _refreshWillUI(html, current){
      const $html = (typeof jQuery !== 'undefined' && html instanceof jQuery) ? html : $(html || this.element);
      const base = Number(this.actor?.system?.baseWill ?? this.actor?.data?.data?.baseWill ?? 0);
      $html.find('.will-current-input').val(current);
      $html.find('.will-slider').attr('max', base).val(current);
      $html.find('.will-display').text(current);
      $html.find('.will-max').text(base);
    }
  }

  Actors.registerSheet('godlike-foundry', GodlikeActorSheet, {
    label: 'Godlike Actor Sheet',
    types: ['Hero','Villain','Pawn','hero','villain','pawn'],
    makeDefault: true
  });

  Hooks.on('createActor', async (actor) => {
    try{
      const base = Number(foundry.utils.getProperty(actor, 'system.baseWill') ?? foundry.utils.getProperty(actor, 'data.data.baseWill') ?? foundry.utils.getProperty(actor, 'data.attributes.baseWill') ?? 0);
      const cur = Number(foundry.utils.getProperty(actor, 'system.willCurrent') ?? foundry.utils.getProperty(actor, 'data.data.willCurrent') ?? -1);
      if(base > 0 && (cur < 0 || cur === 0)){
        await actor.update({'system.willCurrent': base, 'data.willCurrent': base});
      }
    } catch(err) {
      console.error('Godlike | Failed to set default willCurrent on actor creation', err);
    }
  });

  Hooks.on('updateCombat', async (combat, changed) => {
    if (!('turn' in changed)) return;
    try{
      const combatant = combat.combatant;
      if(!combatant) return;
      const actor = combatant.actor;
      if(!actor) return;

      for(const it of actor.items.filter(i => i.type === 'weapon')){
        const sc = Number(foundry.utils.getProperty(it, 'system.slowCounter') ?? foundry.utils.getProperty(it, 'data.data.slowCounter') ?? 0);
        if(sc > 0){
          await it.update({'system.slowCounter': Math.max(0, sc - 1), 'data.slowCounter': Math.max(0, sc - 1)});
          if(sc - 1 <= 0) await it.unsetFlag('one-roll-engine','disabled');
        }
      }
    } catch(err){
      console.error('Godlike | Error decrementing slow counters on combat update', err);
    }
  });

});
