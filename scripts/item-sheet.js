// scripts/item-sheet.js - weapon item sheet for Godlike (Foundry v14)
// Replaces prompt-based input with a proper Foundry Dialog for firing.

class GodlikeWeaponSheet extends ItemSheet {
  static get defaultOptions(){
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes:['godlike','sheet','item'],
      template:'systems/godlike-foundry/templates/items/weapon-sheet.html',
      width:640,
      height:520
    });
  }

  getData(){
    const data = super.getData();
    data.system = this.item?.system ?? this.item?.data?.data ?? {};
    data.flags = this.item?.flags?.['one-roll-engine'] ?? this.item?.data?.flags?.['one-roll-engine'] ?? {};
    return data;
  }

  activateListeners(html){
    super.activateListeners(html);
    
    // Ensure html is a jQuery object for consistent API
    const $html = html instanceof jQuery ? html : $(html);
    
    $html.find('.reload-btn').on('click', this._onReload.bind(this));
    $html.find('.shoot-btn').on('click', this._onOpenFireDialog.bind(this));
  }

  async _onReload(ev){
    ev.preventDefault();
    const cap = Number(foundry.utils.getProperty(this.item, 'system.magCap') ?? foundry.utils.getProperty(this.item, 'data.data.magCap') ?? 0);
    await this.item.update({'system.magCurrent': cap, 'data.magCurrent': cap});
    ui.notifications.info(`${this.item.name} reloaded to ${cap} rounds.`);
  }

  async _onOpenFireDialog(ev){
    ev.preventDefault();
    const item = this.item;
    const w = item.system ?? item.data.data;

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
          <label><input type="checkbox" name="useSpray" ${(w.spray ?? 0)>0 ? '' : 'disabled'} /> Use Spray (${w.spray||0})</label>
        </div>
        <div class="form-group">
          <label><input type="checkbox" name="useArea" ${(w.area ?? 0)>0 ? '' : 'disabled'} /> Use Area (${w.area||0})</label>
        </div>
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

            const magCurrent = Number(foundry.utils.getProperty(item, 'system.magCurrent') ?? foundry.utils.getProperty(item, 'data.data.magCurrent') ?? 0);
            if(magCurrent <= 0){
              ui.notifications.warn(`${item.name} has no ammo.`);
              return;
            }
            await item.update({'system.magCurrent': Math.max(0, magCurrent - 1), 'data.magCurrent': Math.max(0, magCurrent - 1)});

            ChatMessage.create({content: `<strong>Fired ${item.name}</strong><br>Modifier: ${modifier} Hard: ${hard} Wiggle: ${wiggle}`});
          }
        },
        cancel: { label: 'Cancel' }
      }
    }).render(true);
  }
}

Hooks.once('init', () => {
  Items.registerSheet('godlike-foundry', GodlikeWeaponSheet, {
    label: 'Godlike Weapon Sheet',
    types: ['weapon','magazine'],
    makeDefault: true
  });
});

window.GodlikeWeaponSheet = GodlikeWeaponSheet;
