// item-sheet.js - weapon item sheet for Godlike (Foundry v14)
// Replaces prompt-based input with a proper Foundry Dialog for firing.

class GodlikeWeaponSheet extends ItemSheet {
  static get defaultOptions(){
    return mergeObject(super.defaultOptions, {
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
            const hard = Math.max(0, Number(fd.get('hard')||0));
            const wiggle = Math.max(0, Number(fd.get('wiggle')||0));
            const wiggleValuesText = String(fd.get('wiggleValues')||'').trim();
            const wiggleValues = wiggleValuesText.length ? wiggleValuesText.split(',').map(s=>Number(s.trim())).filter(n=>!Number.isNaN(n)) : [];
            const useSpray = fd.get('useSpray')!==null && fd.get('useSpray')!=='false';
            const useArea = fd.get('useArea')!==null && fd.get('useArea')!=='false';

            // Determine the skill pool; prefer item-linked fields if any
            const skillPool = Number(getProperty(this.actor.data, `data.skills.${w.skill}?.value`) || w.basePool || 0);

            // Call the ore rollout helper
            await window.godlike_ore_roll({
              actor: this.actor,
              weapon: item,
              skillPool,
              mod: modifier,
              hard: hard,
              wiggleCount: wiggle,
              wiggleValues,
              sprayOn: !!useSpray,
              areaExtra: useArea ? Number(w.area||0) : 0
            });
          }
        },
        cancel: {label: 'Cancel'}
      },
      default: 'fire'
    }).render(true);
  }
}

// Export to global for registration in system init
window.GodlikeWeaponSheet = GodlikeWeaponSheet;
