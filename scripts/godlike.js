// scripts/godlike.js - Actor sheet registration and Willpower handling

Hooks.once('init', ()=>{
  console.log('Godlike | Initializing Godlike system (Willpower support)');

  class GodlikeActorSheet extends ActorSheet {
    static get defaultOptions(){
      return mergeObject(super.defaultOptions, {
        classes:['godlike','sheet','actor'],
        template: 'templates/sheets/godlike-sheet.html',
        width: 980,
        height: 760,
        tabs: [{navSelector: ".tabs", contentSelector: ".sheet-body", initial: "attributes"}]
      });
    }

    getData(){
      const data = super.getData();
      // Provide a convenient reference to actor data as 'system'
      data.system = data.actor.data.data;
      return data;
    }

    activateListeners(html){
      super.activateListeners(html);

      // Willpower controls
      html.find('.will-decr').on('click', async ev => {
        ev.preventDefault();
        const cur = Number(this.actor.data.data.willCurrent || 0);
        const newVal = Math.max(0, cur - 1);
        await this.actor.update({'data.willCurrent': newVal});
        this._refreshWillUI(html, newVal);
      });

      html.find('.will-incr').on('click', async ev => {
        ev.preventDefault();
        const base = Number(this.actor.data.data.baseWill || 0);
        const cur = Number(this.actor.data.data.willCurrent || base);
        const newVal = Math.min(base, cur + 1);
        await this.actor.update({'data.willCurrent': newVal});
        this._refreshWillUI(html, newVal);
      });

      html.find('.will-current-input').on('change', async ev => {
        const val = Number(ev.currentTarget.value || 0);
        const base = Number(this.actor.data.data.baseWill || 0);
        const clamped = Math.max(0, Math.min(base, val));
        await this.actor.update({'data.willCurrent': clamped});
        this._refreshWillUI(html, clamped);
      });

      html.find('.base-will-input').on('change', async ev => {
        const baseVal = Math.max(0, Number(ev.currentTarget.value || 0));
        const cur = Number(this.actor.data.data.willCurrent || 0);
        const newCur = Math.min(cur, baseVal);
        await this.actor.update({'data.baseWill': baseVal, 'data.willCurrent': newCur});
        // refresh UI
        this._refreshWillUI(html, newCur);
      });

      html.find('.will-slider').on('input', async ev => {
        const val = Number(ev.currentTarget.value || 0);
        // Update displayed value live but don't persist until change event
        html.find('.will-display').text(val);
      });

      html.find('.will-slider').on('change', async ev => {
        const val = Number(ev.currentTarget.value || 0);
        const base = Number(this.actor.data.data.baseWill || 0);
        const clamped = Math.max(0, Math.min(base, val));
        await this.actor.update({'data.willCurrent': clamped});
        this._refreshWillUI(html, clamped);
      });
    }

    _refreshWillUI(html, current){
      html = html || this.element;
      const base = Number(this.actor.data.data.baseWill || 0);
      html.find('.will-current-input').val(current);
      html.find('.will-slider').attr('max', base).val(current);
      html.find('.will-display').text(current);
      html.find('.will-max').text(base);
    }
  }

  Actors.registerSheet('godlike', GodlikeActorSheet, { makeDefault: true });

  // Ensure newly created actors have willCurrent defaulted to baseWill
  Hooks.on('createActor', async (actor, options, userId) => {
    try{
      const base = Number(getProperty(actor.data, 'data.baseWill') || getProperty(actor.data, 'data.attributes.baseWill') || 0);
      const cur = Number(getProperty(actor.data, 'data.willCurrent') || -1);
      if(base > 0 && (cur < 0 || cur === 0)){
        await actor.update({'data.willCurrent': base});
      }
    } catch(err) {
      console.error('Godlike | Failed to set default willCurrent on actor creation', err);
    }
  });

});
