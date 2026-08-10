// Module-scoped mergeObject binding: prefer Foundry's implementation, fall back to a safe deep-merge.
const mergeObject = (function() {
  try {
    if (typeof foundry !== 'undefined' && foundry?.utils && typeof foundry.utils.mergeObject === 'function') {
      return foundry.utils.mergeObject.bind(foundry.utils);
    }
  } catch (e) {}
  try {
    if (typeof window !== 'undefined' && typeof window.mergeObject === 'function') {
      return window.mergeObject.bind(window);
    }
  } catch (e) {}
  // Lightweight fallback deep-merge (sufficient for defaultOptions merging)
  return function mergeObjectFallback(target = {}, source = {}, options = {}) {
    const isObject = o => o && typeof o === 'object' && !Array.isArray(o);
    const out = JSON.parse(JSON.stringify(target || {}));
    const src = source || {};
    Object.keys(src).forEach(key => {
      const sv = src[key];
      if (isObject(sv) && isObject(out[key])) out[key] = mergeObjectFallback(out[key], sv, options);
      else out[key] = sv;
    });
    return out;
  };
})();

// item-sheet.js - weapon item sheet for Godlike (Foundry v14)
// Replaces prompt-based input with a proper Foundry Dialog for firing.

class GodlikeWeaponSheet extends ItemSheet {
  static get defaultOptions(){
    // Use foundry.utils.mergeObject to avoid mergeObject being undefined in some environments
    const _merge = (typeof foundry !== 'undefined' && foundry?.utils && typeof foundry.utils.mergeObject === 'function') ? foundry.utils.mergeObject : mergeObject;
    return _merge(super.defaultOptions, {
      classes:['godlike','sheet','item'],
      template:'templates/items/weapon-sheet.html',
      width:640,
      height:520
    });
  }

  getData(){
    const data = super.getData();
    data.flags = this.item.data.flags['one-roll-engine'] || {};
    return data;
  }

  activateListeners(html){
    super.activateListeners(html);
    html.find('.reload-btn').on('click', this._onReload.bind(this));
    html.find('.shoot-btn').on('click', this._onOpenFireDialog.bind(this));
  }

  async _onReload(ev){
    ev.preventDefault();
    // Simple reload: set magCurrent to magCap (consumes one magazine in a later pass)
    const cap = Number(getProperty(this.item.data, 'data.magCap')||0);
    await this.item.update({'data.magCurrent': cap});
    ui.notifications.info(`${this.item.name} reloaded to ${cap} rounds.`);
  }

  async _onOpenFireDialog(ev){
    ev.preventDefault();
    const item = this.item;
    const w = item.data.data;

    const html = `
      <form>
        <div class="form-group">
          <label>Modifier (adds/subtracts dice): <input type="number" name="modifier" value="0"/></label>
        </div>
        <div class="form-group">
          <label>Hard dice (count): <input type="number" name="hard" value="0" min="0"/></label>
        </div>
        <div class="form-group">
          <label>Wiggle dice (count): <input type="number" name="wiggle" value="0" min="0"/></label>
        </div>
        <div class="form-group">
          <label>Wiggle values (comma-separated, optional): <input type="text" name="wiggleValues" placeholder="e.g. 10,7"/></label>
        </div>
        <div class="form-group">
          <label><input type="checkbox" name="useSpray" ${w.spray>0 ? '' : 'disabled'} /> Use Spray (${w.spray||0})</label>
        </div>
        <div class="form-group">
          <label><input type="checkbox" name="useArea" ${w.area>0 ? '' : 'disabled'} /> Use Area (${w.area||0})</label>
        </div>
        <div class="form-group small">Burn: ${w.burnEnabled ? (`Yes (${w.burnValue||0}) - ${w.burnNote||''}`) : 'No'}</div>
        <div class="note small">Dice pool will be calculated from provided skill/pool and modifier; Hard and Wiggle dice are applied within the pool (not added on). Total dice capped at 10.</div>
      </form>
    `;

    new Dialog({
      title: `Fire ${item.name}`,
      content: html,
      buttons: {
        fire: {
          icon: '<i class="fas fa-bullseye"></i>',
          label: 'Fire',
          callback: async (htmlDialog) => {
            const form = htmlDialog[0].querySelector('form');
            const fd = new FormData(form);
            const modifier = Number(fd.get('modifier')||0);
            const hard = Number(fd.get('hard')||0);
            const wiggle = Number(fd.get('wiggle')||0);
            const wiggleValues = (fd.get('wiggleValues')||'').toString().split(',').map(s=>Number(s.trim())).filter(n=>!Number.isNaN(n));
            const useSpray = fd.get('useSpray') !== null;
            const useArea = fd.get('useArea') !== null;

            // Basic ammo handling (consume 1 round or handle spray differently later)
            const magCurrent = Number(getProperty(item.data, 'data.magCurrent')||0);
            if(magCurrent <= 0){
              ui.notifications.warn(`${item.name} has no ammo.`);
              return;
            }
            await item.update({'data.magCurrent': Math.max(0, magCurrent - 1)});

            // Roll placeholder (implement ORE roll in ore.js)
            const rollResult = {matches:[],damage:0};
            ChatMessage.create({content: `<strong>Fired ${item.name}</strong><br>Modifier: ${modifier} Hard: ${hard} Wiggle: ${wiggle}`});
          }
        },
        cancel: { label: 'Cancel' }
      }
    }).render(true);
  }
}

// Export to global for registration by the system init script if needed
window.GodlikeWeaponSheet = GodlikeWeaponSheet;
