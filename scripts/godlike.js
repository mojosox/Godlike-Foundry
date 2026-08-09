// godlike.js - system bootstrap and sheet registration

Hooks.once('init', ()=>{
  console.log('Godlike | Initializing Godlike system');
  game.system.apps = game.system.apps || {};

  // Register actor sheet (simple mock to use the template)
  class GodlikeActorSheet extends ActorSheet {
    static get defaultOptions(){
      return mergeObject(super.defaultOptions, {
        classes:['godlike','sheet','actor'],
        template:'templates/sheets/godlike-sheet.html',
        width: 920,
        height: 760
      });
    }
  }
  Actors.registerSheet('godlike', GodlikeActorSheet, { makeDefault:true });

  // Expose a friendly API hook for the ORE roll engine
  game.godlike = game.godlike || {};
  game.godlike.rollORE = async function(opts){
    return window.godlike_ore_roll ? window.godlike_ore_roll(opts) : undefined;
  }
});
