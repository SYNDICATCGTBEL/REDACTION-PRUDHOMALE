(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LegalWritingAids = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const FORMULAS = [
    { id:'rappel', label:'Transition — rappel', fields:['litige','regleDroit','enEspece','enConsequence'], text:'Il convient de rappeler que ' },
    { id:'pieces', label:'Constat tiré des pièces', fields:['litige','enEspece'], text:'Il résulte des pièces versées aux débats que ' },
    { id:'conseil-constate', label:'Le Conseil constate', fields:['enEspece'], text:'Le Conseil constate que ' },
    { id:'conseil-releve', label:'Le Conseil relève', fields:['enEspece'], text:'Le Conseil relève que ' },
    { id:'contradictoire', label:'Après examen contradictoire', fields:['enEspece'], text:'Après examen contradictoire des éléments produits par les parties, ' },
    { id:'demandeur-soutient', label:'Le demandeur soutient', fields:['conclusionsDemandeur'], text:'À l’appui de ses prétentions, le demandeur soutient que ' },
    { id:'defendeur-soutient', label:'Le défendeur fait valoir', fields:['conclusionsDefendeur'], text:'En défense, le défendeur fait valoir que ' },
    { id:'aux-termes', label:'Aux termes du texte applicable', fields:['regleDroit'], text:'Aux termes de [À compléter : article ou texte applicable], ' },
    { id:'resulte-dispositions', label:'Il résulte de ces dispositions', fields:['regleDroit'], text:'Il résulte de ces dispositions que ' },
    { id:'en-espece', label:'En l’espèce', fields:['enEspece'], text:'En l’espèce, ' },
    { id:'en-consequence', label:'En conséquence', fields:['enConsequence'], text:'En conséquence, ' },
    { id:'des-lors', label:'Dès lors', fields:['enConsequence'], text:'Dès lors, ' },
    { id:'il-convient', label:'Il convient en conséquence', fields:['enConsequence'], text:'Il convient en conséquence de ' },
    { id:'dit-que', label:'DIT que', fields:['dispositif'], text:'DIT que ' },
    { id:'deboute', label:'DÉBOUTE', fields:['dispositif'], text:'DÉBOUTE [À compléter : partie] de sa demande au titre de [À compléter : objet] ;' }
  ];
  const TEMPLATES = [
    { id:'chronologie', label:'Chronologie de la relation de travail', fields:['litige'], text:'[À compléter : identité] a été engagé(e) par [À compléter : employeur] le [À compléter : date], en qualité de [À compléter : emploi], selon [À compléter : nature du contrat].\n\nLa relation de travail était soumise à [À compléter : convention collective].\n\nPar [À compléter : acte et date], [À compléter : événement ou rupture].' },
    { id:'procedure', label:'Procédure et renvoi devant le jugement', fields:['litige'], text:'Le Conseil de prud’hommes a été saisi par requête reçue au greffe le [À compléter : date].\n\nAucune conciliation n’étant intervenue, l’affaire a été renvoyée devant le bureau de jugement à l’audience du [À compléter : date].' },
    { id:'pretentions-demandeur', label:'Prétentions du demandeur', fields:['conclusionsDemandeur'], text:'Le demandeur sollicite :\n\n- [À compléter : première demande] ;\n- [À compléter : montant ou mesure sollicitée] ;\n- [À compléter : demande accessoire].\n\nIl soutient en substance que [À compléter : moyens invoqués].' },
    { id:'pretentions-defendeur', label:'Prétentions du défendeur', fields:['conclusionsDefendeur'], text:'Le défendeur demande au Conseil de :\n\n- débouter le demandeur de [À compléter : demande contestée] ;\n- [À compléter : demande subsidiaire ou accessoire].\n\nIl fait valoir en substance que [À compléter : moyens de défense].' },
    { id:'majeure', label:'Règle de droit — majeure', fields:['regleDroit'], text:'Aux termes de [À compléter : texte applicable], [À compléter : contenu exact de la règle].\n\nIl en résulte que [À compléter : condition juridique à vérifier].' },
    { id:'mineure', label:'Application aux faits — mineure', fields:['enEspece'], text:'En l’espèce, [À compléter : faits établis].\n\nLe demandeur produit [À compléter : pièces utiles]. Le défendeur oppose [À compléter : éléments contraires].\n\nIl ressort de l’examen contradictoire de ces éléments que [À compléter : constat du Conseil].' },
    { id:'conclusion-accord', label:'Conclusion — demande fondée', fields:['enConsequence'], text:'En conséquence, les conditions de [À compléter : qualification ou droit] sont réunies. La demande est donc fondée [À compléter : en totalité ou dans la limite de].' },
    { id:'conclusion-rejet', label:'Conclusion — demande rejetée', fields:['enConsequence'], text:'En conséquence, les éléments produits ne permettent pas d’établir [À compléter : condition manquante]. La demande sera donc rejetée.' },
    { id:'dispositif-condamnation', label:'Dispositif — condamnation', fields:['dispositif'], text:'CONDAMNE [À compléter : partie] à payer à [À compléter : bénéficiaire] la somme de [À compléter : montant] au titre de [À compléter : objet] ;' },
    { id:'dispositif-rejet', label:'Dispositif — rejet', fields:['dispositif'], text:'DÉBOUTE [À compléter : partie] de sa demande au titre de [À compléter : objet] ;' }
  ];
  function itemsFor(field, type) { const source=type==='template'?TEMPLATES:FORMULAS; return source.filter(item=>item.fields.includes(field)).map(item=>({...item,fields:[...item.fields]})); }
  function mount(container, options) {
    if (!container || !options?.document || typeof options.onInsert!=='function') return;
    const document=options.document; container.replaceChildren(); container.className='legal-writing-aids';
    const addPicker=(title,type,placeholder)=>{ const items=itemsFor(options.field,type); if(!items.length)return; const group=document.createElement('div'); group.className='legal-writing-picker'; const label=document.createElement('label'); label.textContent=title; const select=document.createElement('select'); select.setAttribute('aria-label',title); select.innerHTML=`<option value="">${placeholder}</option>`+items.map(item=>`<option value="${item.id}">${item.label}</option>`).join(''); const button=document.createElement('button'); button.type='button'; button.className='text-button'; button.textContent='Insérer'; button.disabled=true; select.addEventListener('change',()=>{button.disabled=!select.value;}); button.addEventListener('click',()=>{const item=items.find(entry=>entry.id===select.value);if(!item)return;options.onInsert(item.text,{type,id:item.id});select.value='';button.disabled=true;}); label.appendChild(select); group.append(label,button); container.appendChild(group); };
    addPicker('Formule juridique rapide','formula','— Choisir une formule —'); addPicker('Modèle de paragraphe','template','— Choisir un modèle —');
  }
  return { FORMULAS, TEMPLATES, itemsFor, mount };
});
