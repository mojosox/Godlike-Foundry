// item-sheet.js - simple item sheet for weapons with magazine and special features

class GodlikeWeaponSheet extends ItemSheet {
  static get defaultOptions(){
    return mergeObject(super.defaultOptions,{
      classes:['godlike','sheet','item'],
      template:'templates/items/weapon-sheet.html',
      width:600,
      height:480
    });
  }

  getData(){
    const data = super.getData();
    return data;
  }

  activateListeners(html){
    super.activateListeners(html);
    html.find('.reload-btn').on('click', async ev=>{
      const rounds = Number(prompt('Rounds to load:', '0'))||0;
      const data = duplicate(this.item.data);
      data.data.magCurrent = Math.min((data.data.magCap||0), (data.data.magCurrent||0)+rounds);
      await this.item.update({"data.magCurrent": data.data.magCurrent});
    });
    html.find('.shoot-btn').on('click', ev=>{
      // gather rolling options then call ore roll
      const data = this.item.data.data;
      const mod = Number(prompt('Modifier:', '0'))||0;
      const hard = Number(prompt('Hard dice count:', '0'))||0;
      const wiggle = Number(prompt('Wiggle dice count:', '0'))||0;
      const sprayOn = confirm('Use Spray?') && (data.spray||0)>0;
      game.godlike.rollORE({actor:this.actor, weapon:this.item, skillPool:(this.actor.data.data.skills?.example||0), mod, hard, wiggle, sprayOn});
    });
  }
}

// Register later in godlike.js; for now export to global
window.GodlikeWeaponSheet = GodlikeWeaponSheet;
