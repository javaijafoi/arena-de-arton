/* Arena de Arton — dados: classes, magias, criaturas e encontros.
   Regras simplificadas a partir de Tormenta20 (Resumo de Regras, Baralho de Magias, Guia de NPCs).
   Valores marcados com "aprox" foram estimados para o jogo; o resto vem dos livros. */
(function (root) {
  'use strict';

  // Quadrados: 1 q = 1,5 m. Curto = 9 m (6 q), médio = 30 m (20 q).
  const ALCANCE = { pessoal: 0, toque: 1, curto: 6, medio: 20, longo: 40 };
  const CUSTO_CIRCULO = { 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 };

  /* ---------------- ARMAS ---------------- */
  const ARMAS = {
    machadoBatalha: { nome: 'Machado de batalha', dano: [1, 8], margem: 20, mult: 3, tipo: 'corte', alcance: 1, atributo: 'for' },
    machadoGuerra: { nome: 'Machado de guerra', dano: [1, 12], margem: 20, mult: 3, tipo: 'corte', alcance: 1, atributo: 'for', duasMaos: true },
    espadaLonga: { nome: 'Espada longa', dano: [1, 8], margem: 19, mult: 2, tipo: 'corte', alcance: 1, atributo: 'for' },
    maca: { nome: 'Maça', dano: [1, 8], margem: 20, mult: 2, tipo: 'impacto', alcance: 1, atributo: 'for' },
    bordao: { nome: 'Bordão', dano: [1, 6], margem: 20, mult: 2, tipo: 'impacto', alcance: 1, atributo: 'for' },
    espadaCurta: { nome: 'Espada curta', dano: [1, 6], margem: 19, mult: 2, tipo: 'perfuração', alcance: 1, atributo: 'for', leve: true },
    rapieira: { nome: 'Florete', dano: [1, 6], margem: 18, mult: 2, tipo: 'perfuração', alcance: 1, atributo: 'for', leve: true },
    arcoLongo: { nome: 'Arco longo', dano: [1, 8], margem: 20, mult: 3, tipo: 'perfuração', alcance: 20, distancia: true, atributo: 'des' },
  };

  /* ---------------- CLASSES (heróis) ----------------
     Atributos como modificadores de T20. Perícias = metade do nível + atributo + treino (+2/+4/+6). */
  const CLASSES = {
    guerreiro: {
      nome: 'Guerreiro', attr: { for: 4, des: 1, con: 2, int: 0, sab: 1, car: 0 },
      pv: [20, 5], pm: 3, armadura: 6, escudo: 2, armaduraPesada: true, arma: 'machadoBatalha',
      treinadas: ['luta', 'fort', 'inic', 'ref'], desloc: 6,
      habilidades: ['ataqueEspecial', 'ataqueExtra'],
      descricao: 'Mestre das armas. Ataque Especial gasta PM para acertar mais ou bater mais forte.'
    },
    barbaro: {
      nome: 'Bárbaro', attr: { for: 4, des: 1, con: 3, int: -1, sab: 1, car: 0 },
      pv: [24, 6], pm: 3, armadura: 4, escudo: 0, arma: 'machadoGuerra',
      treinadas: ['luta', 'fort', 'inic', 'von'], desloc: 6,
      habilidades: ['furia', 'reducaoDano'],
      descricao: 'Fúria dá bônus de ataque e dano. A partir do 5º nível ignora parte do dano.'
    },
    paladino: {
      nome: 'Paladino', attr: { for: 3, des: 0, con: 2, int: 0, sab: 1, car: 3 },
      pv: [20, 5], pm: 3, armadura: 8, escudo: 2, armaduraPesada: true, arma: 'espadaLonga',
      treinadas: ['luta', 'fort', 'von', 'inic'], desloc: 6,
      habilidades: ['golpeDivino', 'curaMaos'],
      descricao: 'Golpe Divino soma Carisma ao ataque e dano sagrado. Cura pelas Mãos salva aliados.'
    },
    clerigo: {
      nome: 'Clérigo', attr: { for: 1, des: 0, con: 2, int: 0, sab: 4, car: 1 },
      pv: [16, 4], pm: 5, armadura: 5, escudo: 2, armaduraPesada: true, arma: 'maca',
      treinadas: ['luta', 'von', 'fort', 'inic'], desloc: 6, conjurador: 'sab', tipoMagia: 'divina',
      magias: ['curarFerimentos', 'bencao', 'escudoDaFe', 'infligirFerimentos', 'perdicao', 'armaEspiritual', 'oracao', 'raioSolar', 'sopro', 'colunaChamas', 'coleraAzgher'],
      descricao: 'Cura, abençoa e queima mortos-vivos com luz.'
    },
    arcanista: {
      nome: 'Arcanista', attr: { for: 0, des: 2, con: 1, int: 4, sab: 1, car: 0 },
      pv: [8, 2], pm: 6, armadura: 0, escudo: 0, arma: 'bordao',
      treinadas: ['von', 'inic', 'ref', 'fort'], desloc: 6, conjurador: 'int', tipoMagia: 'arcana',
      magias: ['setaInfalivel', 'explosaoChamas', 'armaduraArcana', 'sono', 'teia', 'leque', 'toqueChocante', 'raioEnfraquecimento', 'bolaDeFogo', 'relampago', 'flechaAcida', 'velocidade', 'lancaIgnea', 'raioPolar', 'desintegrar'],
      descricao: 'Pouca vida, muito poder. Bola de Fogo no 5º nível, Lança Ígnea no 9º, Raio Polar no 13º.'
    },
    cacador: {
      nome: 'Caçador', attr: { for: 1, des: 4, con: 1, int: 0, sab: 2, car: 0 },
      pv: [16, 4], pm: 4, armadura: 3, escudo: 0, arma: 'arcoLongo',
      treinadas: ['pont', 'ref', 'fort', 'inic'], desloc: 6,
      habilidades: ['marcaPresa', 'tiroCerteiro'],
      descricao: 'Arqueiro. Marca da Presa aumenta o dano contra um alvo pela cena.'
    },
    ladino: {
      nome: 'Ladino', attr: { for: 1, des: 4, con: 1, int: 2, sab: 0, car: 1 },
      pv: [12, 3], pm: 4, armadura: 2, escudo: 0, arma: 'espadaCurta',
      treinadas: ['luta', 'ref', 'inic', 'engan'], desloc: 6,
      habilidades: ['ataqueFurtivo', 'fintar', 'evasao'],
      descricao: 'Ataque Furtivo contra alvos flanqueados ou desprevenidos. Fintar abre a guarda.'
    },
    cavaleiro: {
      nome: 'Cavaleiro', attr: { for: 3, des: 0, con: 3, int: 0, sab: 1, car: 2 },
      pv: [20, 5], pm: 3, armadura: 8, escudo: 2, armaduraPesada: true, arma: 'espadaLonga',
      treinadas: ['luta', 'fort', 'von', 'inic'], desloc: 6,
      habilidades: ['baluarte', 'bastiao', 'desafio'],
      descricao: 'A muralha do grupo. Baluarte gasta PM para fechar a guarda; Desafio prende um inimigo nele.'
    },
    bardo: {
      nome: 'Bardo', attr: { for: 1, des: 2, con: 1, int: 1, sab: 0, car: 4 },
      pv: [12, 3], pm: 4, armadura: 3, escudo: 0, arma: 'rapieira',
      treinadas: ['luta', 'von', 'ref', 'engan', 'inic'], desloc: 6, conjurador: 'car', tipoMagia: 'arcana',
      habilidades: ['inspiracao', 'fintar'],
      magias: ['leque', 'sono', 'amedrontar', 'despedacar', 'escudoDaFe', 'velocidade', 'curarFerimentos'],
      descricao: 'Inspiração dá bônus ao grupo. Magias de controle e som.'
    },
  };

  /* Heróis disponíveis (token + classe) */
  const HEROIS = [
    { id: 'mari', nome: 'Mari Labareda', classe: 'guerreiro', token: 'mari-labareda' },
    { id: 'durgalinn', nome: 'Durgalinn', classe: 'barbaro', token: 'durgalinn' },
    { id: 'aegoron', nome: 'Sir Aegoron', classe: 'paladino', token: 'aegoron' },
    { id: 'hana', nome: 'Hanalendariana', classe: 'clerigo', token: 'hanalendariana' },
    { id: 'zaldrin', nome: 'Zaldrin', classe: 'arcanista', token: 'zaldrin' },
    { id: 'aria', nome: 'Ária', classe: 'cacador', token: 'aria' },
    { id: 'safira', nome: 'Safira', classe: 'ladino', token: 'safira' },
    { id: 'lia', nome: 'Dame Lia', classe: 'bardo', token: 'dame-lia' },
    { id: 'cavaleiro', nome: 'Cavaleiro Iniciante', classe: 'cavaleiro', token: 'cavaleiro-iniciante' },
  ];

  /* ---------------- HABILIDADES DE CLASSE ---------------- */
  const HABILIDADES = {
    ataqueEspecial: { nome: 'Ataque Especial', desc: 'Gaste PM para +4 no ataque ou no dano (a cada 4 níveis, +1 PM para mais +4).', tipo: 'modAtaque' },
    ataqueExtra: { nome: 'Ataque Extra', desc: 'A partir do 6º nível: 2 PM para um ataque adicional na mesma ação.', nivel: 6, tipo: 'modAtaque' },
    furia: { nome: 'Fúria', desc: '2 PM: +2 em ataque e dano corpo a corpo e resistência a dano pela cena (+1 por 5 níveis gastando +1 PM). Ação livre.', tipo: 'livre', custo: 2 },
    reducaoDano: { nome: 'Redução de Dano', desc: 'A partir do 5º nível, reduz todo dano sofrido em 2 (4 no 8º).', tipo: 'passiva' },
    golpeDivino: { nome: 'Golpe Divino', desc: '2 PM: soma Carisma ao ataque e +1d8 de dano de luz (+1d8 por 4 níveis com +1 PM).', tipo: 'modAtaque' },
    curaMaos: { nome: 'Cura pelas Mãos', desc: 'Ação de movimento, 1 PM: cura 1d8+1 PV em você ou num aliado adjacente (+1d8+1 por 4 níveis com +1 PM).', tipo: 'movimento' },
    marcaPresa: { nome: 'Marca da Presa', desc: 'Ação de movimento, 1 PM: +1d4 de dano contra o alvo pela cena (1d8 no 5º, 1d12 no 9º).', tipo: 'movimento' },
    tiroCerteiro: { nome: 'Disparo Preciso', desc: 'Sem penalidade de –5 ao atirar em alvos em corpo a corpo.', tipo: 'passiva' },
    ataqueFurtivo: { nome: 'Ataque Furtivo', desc: '+1d6 de dano (mais 1d6 a cada 2 níveis) contra alvos flanqueados ou desprevenidos.', tipo: 'passiva' },
    fintar: { nome: 'Fintar', desc: 'Ação padrão: Enganação contra Reflexos de um inimigo em alcance curto. Se vencer, ele fica desprevenido contra o seu próximo ataque.', tipo: 'padrao' },
    evasao: { nome: 'Evasão', desc: 'Ao passar em Reflexos contra área, não sofre dano.', tipo: 'passiva' },
    baluarte: { nome: 'Baluarte', desc: 'Ação livre, 1 PM: +2 na Defesa e nas resistências até o seu próximo turno (+2 a mais a cada 4 níveis, gastando +1 PM).', tipo: 'livre', custo: 1 },
    bastiao: { nome: 'Bastião', desc: 'A partir do 5º nível, reduz todo dano sofrido em 2 enquanto usa armadura pesada (4 no 10º).', tipo: 'passiva' },
    desafio: { nome: 'Desafio', desc: 'Ação de movimento, 1 PM: um inimigo em alcance curto sofre –2 em ataques contra outros alvos que não você, e você recebe +2 em ataques contra ele, pela cena.', tipo: 'movimento', aprox: true },
    inspiracao: { nome: 'Inspiração', desc: 'Ação padrão, 2 PM: aliados em alcance curto recebem +1 em testes e dano pela cena (+1 a cada 4 níveis com +2 PM).', tipo: 'padrao' },
  };

  /* ---------------- MAGIAS ----------------
     forma: 'alvo' | 'si' | 'aliado' | 'esfera' | 'cone' | 'linha' | 'cubo' | 'auraAliados'
     aprim: aprimoramentos {id, custo, nome, circulo(req)} — o efeito é lido no motor. */
  const MAGIAS = {
    setaInfalivel: {
      nome: 'Seta Infalível de Talude', circulo: 1, escola: 'evocação', exec: 'padrao', alcance: 'medio', forma: 'alvo', alvos: 'inimigo',
      desc: 'Duas setas de energia que nunca erram: 1d4+1 de dano de essência cada.', fx: 'seta', cor: '#b98cff',
      aprim: [
        { id: 'lancas', custo: 2, nome: 'Lanças de energia (1d8+1 cada)', circulo: 2 },
        { id: 'tres', custo: 2, nome: '3 setas' },
        { id: 'cinco', custo: 4, nome: '5 setas', circulo: 2 },
      ]
    },
    explosaoChamas: {
      nome: 'Explosão de Chamas', circulo: 1, escola: 'evocação', exec: 'padrao', alcance: 4, forma: 'cone', tamanho: 4,
      resist: { teste: 'ref', efeito: 'metade' }, desc: 'Cone de 6 m: 2d6 de fogo (Reflexos reduz à metade).', fx: 'fogo', cor: '#ff7a2f',
      aprim: [
        { id: 'dano', custo: 1, nome: '+1d6 de dano', repetivel: true },
        { id: 'chamas', custo: 1, nome: 'Quem falhar fica em chamas' },
      ]
    },
    armaduraArcana: {
      nome: 'Armadura Arcana', circulo: 1, escola: 'abjuração', exec: 'padrao', alcance: 'pessoal', forma: 'si',
      desc: '+4 na Defesa pela cena.', fx: 'escudo', cor: '#7fd3ff',
      aprim: [{ id: 'mais', custo: 2, nome: '+1 na Defesa', repetivel: true }]
    },
    sono: {
      nome: 'Sono', circulo: 1, escola: 'encantamento', exec: 'padrao', alcance: 'curto', forma: 'alvo', alvos: 'inimigo', ndMax: 2,
      resist: { teste: 'von', efeito: 'parcial' }, desc: 'Alvo de ND 2 ou menor adormece (Vontade: só fica fatigado).', fx: 'sono', cor: '#9fb6ff',
      aprim: [
        { id: 'nd5', custo: 2, nome: 'Afeta ND 5 ou menor', circulo: 2 },
        { id: 'nd10', custo: 5, nome: 'Afeta ND 10 ou menor', circulo: 3 },
      ]
    },
    teia: {
      nome: 'Teia', circulo: 1, escola: 'convocação', exec: 'padrao', alcance: 'curto', forma: 'cubo', tamanho: 4,
      resist: { teste: 'ref', efeito: 'anula' }, desc: 'Cubo de 6 m de teia: quem falhar em Reflexos fica enredado. Vira terreno difícil.', fx: 'teia', cor: '#e8e2d0',
      aprim: [{ id: 'imovel', custo: 1, nome: 'Quem falhar também fica imóvel' }]
    },
    leque: {
      nome: 'Leque Cromático', circulo: 1, escola: 'ilusão', exec: 'padrao', alcance: 3, forma: 'cone', tamanho: 3, ndMax: 2,
      resist: { teste: 'von', efeito: 'parcial' }, desc: 'Cone de 4,5 m: atordoa por 1 rodada e ofusca (ND 2 ou menor). Vontade evita o atordoamento.', fx: 'leque', cor: '#ffd84a',
      aprim: [{ id: 'nd5', custo: 2, nome: 'Afeta ND 5 ou menor', circulo: 2 }]
    },
    toqueChocante: {
      nome: 'Toque Chocante', circulo: 1, escola: 'evocação', exec: 'padrao', alcance: 'toque', forma: 'alvo', alvos: 'inimigo',
      resist: { teste: 'fort', efeito: 'metade' }, desc: '2d8+2 de eletricidade (Fortitude metade; –5 se usar armadura de metal).', fx: 'raio', cor: '#8ee7ff',
      aprim: [
        { id: 'dano', custo: 1, nome: '+1d8+1 de dano', repetivel: true },
        { id: 'area', custo: 2, nome: 'Raios em todos a até 6 m de você' },
      ]
    },
    raioEnfraquecimento: {
      nome: 'Raio do Enfraquecimento', circulo: 1, escola: 'necromancia', exec: 'padrao', alcance: 'curto', forma: 'alvo', alvos: 'inimigo',
      resist: { teste: 'fort', efeito: 'parcial' }, desc: 'Alvo fica fatigado (fraco e vulnerável). Se passar, só vulnerável.', fx: 'raioRoxo', cor: '#b55cff',
      aprim: [{ id: 'exausto', custo: 2, nome: 'Exausto (passou: fatigado)', circulo: 2 }]
    },
    despedacar: {
      nome: 'Despedaçar', circulo: 1, escola: 'evocação', exec: 'padrao', alcance: 'curto', forma: 'alvo', alvos: 'inimigo',
      resist: { teste: 'fort', efeito: 'parcial' }, desc: 'Som agudo: 1d8+2 de impacto e atordoa 1 rodada (Fortitude: metade e sem atordoar). Dobro em construtos.', fx: 'som', cor: '#ffffff',
      aprim: [{ id: 'dano', custo: 2, nome: '+1d8+2 de dano', repetivel: true }]
    },
    amedrontar: {
      nome: 'Amedrontar', circulo: 1, escola: 'necromancia', exec: 'padrao', alcance: 'curto', forma: 'alvo', alvos: 'inimigo', ndMax: 2,
      resist: { teste: 'von', efeito: 'parcial' }, desc: 'Alvo fica apavorado (–2 e foge). Se passar, fica abalado.', fx: 'medo', cor: '#7a5cff',
      aprim: [{ id: 'nd5', custo: 2, nome: 'Afeta ND 5 ou menor', circulo: 2 }]
    },
    curarFerimentos: {
      nome: 'Curar Ferimentos', circulo: 1, escola: 'evocação', exec: 'padrao', alcance: 'toque', forma: 'alvo', alvos: 'qualquer',
      desc: 'Cura 2d8+2 PV. Em mortos-vivos causa dano de luz (Vontade metade).', fx: 'cura', cor: '#7dffa8',
      aprim: [
        { id: 'mais', custo: 1, nome: '+1d8+1 de cura', repetivel: true },
        { id: 'curto', custo: 2, nome: 'Alcance curto' },
      ]
    },
    infligirFerimentos: {
      nome: 'Infligir Ferimentos', circulo: 1, escola: 'necromancia', exec: 'padrao', alcance: 'toque', forma: 'alvo', alvos: 'inimigo',
      resist: { teste: 'fort', efeito: 'metade' }, desc: '2d8+2 de trevas (Fortitude metade). Cura mortos-vivos.', fx: 'trevas', cor: '#6a2a8a',
      aprim: [
        { id: 'fraco', custo: 1, nome: 'Se falhar, fica fraco' },
        { id: 'dano', custo: 2, nome: '+1d8+1 de dano', repetivel: true },
      ]
    },
    bencao: {
      nome: 'Bênção', circulo: 1, escola: 'encantamento', exec: 'padrao', alcance: 'curto', forma: 'auraAliados',
      desc: 'Aliados em alcance curto recebem +1 em ataque e dano pela cena.', fx: 'bencao', cor: '#ffe27a',
      aprim: [{ id: 'mais', custo: 2, nome: '+1 nos bônus', repetivel: true }]
    },
    perdicao: {
      nome: 'Perdição', circulo: 1, escola: 'necromancia', exec: 'padrao', alcance: 'curto', forma: 'auraInimigos',
      desc: 'Inimigos em alcance curto sofrem –1 em ataque e dano pela cena.', fx: 'perdicao', cor: '#8a3d6b',
      aprim: [{ id: 'mais', custo: 2, nome: '–1 a mais', repetivel: true }]
    },
    escudoDaFe: {
      nome: 'Escudo da Fé', circulo: 1, escola: 'abjuração', exec: 'padrao', alcance: 'toque', forma: 'alvo', alvos: 'aliado',
      desc: 'Alvo recebe +2 na Defesa pela cena.', fx: 'escudo', cor: '#ffe9a8',
      aprim: [{ id: 'mais', custo: 2, nome: '+1 na Defesa', repetivel: true }, { id: 'curto', custo: 0, nome: '' }].filter(a => a.nome)
    },
    armaEspiritual: {
      nome: 'Arma Espiritual', circulo: 1, escola: 'convocação', exec: 'padrao', alcance: 'pessoal', forma: 'si',
      desc: 'Uma arma flutua a seu lado pela cena. 1×/rodada, quem atacar você corpo a corpo sofre 2d6 automaticamente (acertando ou não).', fx: 'armaEspiritual', cor: '#ffe27a',
      aprim: [{ id: 'def', custo: 1, nome: 'Também +1 na Defesa' }, { id: 'def2', custo: 2, nome: '+1 a mais na Defesa', repetivel: true },
        { id: 'ataque', custo: 2, nome: 'Sustentada: 1×/rodada, ação livre, a arma acerta sozinha um alvo em alcance curto (2d6)', circulo: 2 },
        { id: 'essencia', custo: 2, nome: 'Dano de essência', circulo: 2 },
        { id: 'duas', custo: 5, nome: 'Duas armas: 2 golpes por rodada', circulo: 3 }]
    },
    oracao: {
      nome: 'Oração', circulo: 2, escola: 'encantamento', exec: 'padrao', alcance: 'curto', forma: 'auraTodos',
      desc: 'Aliados em alcance curto +2 em testes e dano; inimigos –2.', fx: 'bencao', cor: '#fff3b0',
      aprim: [{ id: 'mais', custo: 2, nome: '+1 nos bônus e penalidades' }]
    },
    raioSolar: {
      nome: 'Raio Solar', circulo: 2, escola: 'evocação', exec: 'padrao', alcance: 'medio', forma: 'linha', tamanho: 20,
      resist: { teste: 'ref', efeito: 'parcial' }, desc: 'Linha de luz: 4d8 (4d12 em mortos-vivos) e ofusca. Reflexos: metade e sem ofuscar.', fx: 'luz', cor: '#fff6b8',
      aprim: [
        { id: 'dano', custo: 2, nome: '+1d8 de dano', repetivel: true },
        { id: 'cura', custo: 3, nome: 'Aliados na linha curam 4d8' },
      ]
    },
    sopro: {
      nome: 'Sopro da Salvação', circulo: 3, escola: 'evocação', exec: 'padrao', alcance: 4, forma: 'cone', tamanho: 4, aliadosApenas: true,
      desc: 'Cone de 6 m de vento sagrado: aliados curam 2d8+4 e se livram de medo e cansaço.', fx: 'cura', cor: '#b5ffd0', aprox: true,
      aprim: [{ id: 'mais', custo: 2, nome: '+1d8+2 de cura', repetivel: true }]
    },
    bolaDeFogo: {
      nome: 'Bola de Fogo', circulo: 2, escola: 'evocação', exec: 'padrao', alcance: 'medio', forma: 'esfera', tamanho: 4,
      resist: { teste: 'ref', efeito: 'metade' }, desc: 'Esfera de 6 m de raio: 6d6 de fogo em todos na área (Reflexos metade). Cuidado com aliados!', fx: 'explosao', cor: '#ff6a1f',
      aprim: [{ id: 'dano', custo: 2, nome: '+2d6 de dano', repetivel: true }]
    },
    relampago: {
      nome: 'Relâmpago', circulo: 2, escola: 'evocação', exec: 'padrao', alcance: 'medio', forma: 'linha', tamanho: 20,
      resist: { teste: 'ref', efeito: 'metade' }, desc: 'Linha: 6d6 de eletricidade em todos no caminho (Reflexos metade).', fx: 'raio', cor: '#bfe9ff',
      aprim: [{ id: 'dano', custo: 2, nome: '+2d6 de dano', repetivel: true }]
    },
    flechaAcida: {
      nome: 'Flecha Ácida', circulo: 2, escola: 'evocação', exec: 'padrao', alcance: 'medio', forma: 'alvo', alvos: 'inimigo',
      resist: { teste: 'ref', efeito: 'parcial' }, desc: '4d6 de ácido. Se falhar, sofre mais 2d6 por 2 rodadas.', fx: 'acido', cor: '#9dff3a',
      aprim: [{ id: 'dano', custo: 2, nome: '+1d6 inicial e por rodada', repetivel: true }]
    },
    velocidade: {
      nome: 'Velocidade', circulo: 2, escola: 'transmutação', exec: 'padrao', alcance: 'curto', forma: 'alvo', alvos: 'aliado',
      desc: 'O alvo ganha uma ação padrão ou de movimento extra por turno (não para magias).', fx: 'velocidade', cor: '#7dffef',
      aprim: []
    },
    lancaIgnea: {
      nome: 'Lança Ígnea de Aleph', circulo: 3, escola: 'evocação', exec: 'padrao', alcance: 'medio', forma: 'alvo', alvos: 'inimigo',
      resist: { teste: 'ref', efeito: 'parcial' }, desc: '4d6 fogo + 4d6 perfuração e deixa em chamas (2d6/rodada). Respingos podem incendiar adjacentes.', fx: 'lava', cor: '#ff4a12',
      aprim: [{ id: 'dano', custo: 3, nome: '+2d6 inicial e +1d6 nas chamas', repetivel: true }]
    },
    raioPolar: {
      nome: 'Raio Polar', circulo: 4, escola: 'evocação', exec: 'padrao', alcance: 'medio', forma: 'alvo', alvos: 'inimigo',
      resist: { teste: 'fort', efeito: 'parcial' }, desc: '10d8 de frio e prende no gelo (paralisado). Fortitude: metade e fica lento.', fx: 'gelo', cor: '#bff4ff',
      aprim: [{ id: 'dano', custo: 3, nome: '+2d8 de dano', repetivel: true }]
    },
    colunaChamas: {
      nome: 'Coluna de Chamas', circulo: 3, escola: 'evocação', exec: 'padrao', alcance: 'longo', forma: 'esfera', tamanho: 2,
      resist: { teste: 'ref', efeito: 'metade' }, desc: 'Um pilar de fogo sagrado (3 m de raio) desce dos céus: 6d6 de fogo + 6d6 de luz (Reflexos metade).', fx: 'explosao', cor: '#ffb43a',
      aprim: [{ id: 'dano', custo: 1, nome: '+1d6 de dano', repetivel: true }]
    },
    coleraAzgher: {
      nome: 'Cólera de Azgher', circulo: 4, escola: 'evocação', exec: 'padrao', alcance: 'medio', forma: 'esfera', tamanho: 4,
      resist: { teste: 'ref', efeito: 'parcial' }, desc: 'Explosão de luz dourada (6 m de raio): 10d6 de fogo (10d8 em mortos-vivos), cega e incendeia. Reflexos: metade, sem cegar nem incendiar.', fx: 'explosao', cor: '#ffd84a',
      aprim: [{ id: 'dano', custo: 2, nome: '+2d6 de dano', repetivel: true }]
    },
    desintegrar: {
      nome: 'Desintegrar', circulo: 4, escola: 'transmutação', exec: 'padrao', alcance: 'medio', forma: 'alvo', alvos: 'inimigo',
      resist: { teste: 'fort', efeito: 'parcial' }, desc: 'Raio esverdeado: 10d12 de essência (Fortitude: só 2d12). Quem chegar a 0 PV vira pó.', fx: 'raioVerde', cor: '#7dff6a',
      aprim: [{ id: 'dano', custo: 4, nome: '+2d12 de dano (+1d12 no mínimo)', repetivel: true }]
    },
    // magias de inimigos
    setaMilicia: {
      nome: 'Seta Infalível (5 PM)', circulo: 2, escola: 'evocação', exec: 'padrao', alcance: 'medio', forma: 'alvo', alvos: 'inimigo', custoFixo: 5,
      desc: '3d8+6 de essência, sem errar.', fx: 'seta', cor: '#b98cff', aprim: []
    },
    amarras: {
      nome: 'Amarras Etéreas', circulo: 2, escola: 'convocação', exec: 'padrao', alcance: 'medio', forma: 'alvo', alvos: 'inimigo', custoFixo: 3,
      resist: { teste: 'ref', efeito: 'anula' }, desc: 'Laços de energia deixam o alvo imóvel por 1d4 rodadas (Reflexos anula).', fx: 'teia', cor: '#c6a8ff', aprim: [], aprox: true
    },
  };

  /* ---------------- CRIATURAS (inimigos) ----------------
     ataques: lista feita numa única ação padrão (como nas fichas de T20). */
  const CRIATURAS = {
    kobold: { nome: 'Kobold Corajoso', nd: 0.25, ndTxt: '1/4', token: 'kobold', pv: 7, def: 14, fort: 2, ref: 5, von: 1, inic: 5, desloc: 6,
      ataques: [{ nome: 'Lança', bonus: 4, dano: [1, 6, 1], margem: 20, mult: 2, tipo: 'perfuração' }], tags: ['humanoide'], aprox: true },
    koboldFunda: { nome: 'Patrulheiro Kobold', nd: 0.5, ndTxt: '1/2', token: 'patrulheiro-kobold', pv: 9, def: 14, fort: 2, ref: 6, von: 2, inic: 6, desloc: 6,
      ataques: [{ nome: 'Adaga', bonus: 4, dano: [1, 4, 0], margem: 19, mult: 2, tipo: 'perfuração' }],
      distancia: { nome: 'Funda', bonus: 7, dano: [1, 6, 2], alcance: 12, margem: 20, mult: 2, tipo: 'impacto' }, tags: ['humanoide'], aprox: true },
    capanga: { nome: 'Capanga', nd: 0.5, ndTxt: '1/2', token: 'capanga', pv: 15, def: 14, fort: 4, ref: 2, von: 0, inic: 4, desloc: 6,
      ataques: [{ nome: 'Tacape', bonus: 7, dano: [1, 10, 4], margem: 20, mult: 2, tipo: 'impacto' }], tags: ['humanoide'] },
    lobo: { nome: 'Lobo Branco', nd: 0.5, ndTxt: '1/2', token: 'lobo-branco', pv: 21, def: 14, fort: 6, ref: 3, von: 2, inic: 1, desloc: 8,
      ataques: [{ nome: 'Mordida', bonus: 5, dano: [1, 8, 2], margem: 20, mult: 2, tipo: 'perfuração', derrubar: true }], tags: ['animal'] },
    zumbi: { nome: 'Zumbi', nd: 0.5, ndTxt: '1/2', token: 'zumbi', pv: 22, def: 11, fort: 6, ref: 0, von: 2, inic: -1, desloc: 4,
      ataques: [{ nome: 'Pancada', bonus: 6, dano: [1, 6, 4], margem: 20, mult: 2, tipo: 'impacto' }], tags: ['morto-vivo'], imune: ['mental', 'sono'], aprox: true },
    saqueador: { nome: 'Saqueador das Uivantes', nd: 1, ndTxt: '1', token: 'saqueador', pv: 24, def: 15, fort: 5, ref: 5, von: 4, inic: 7, desloc: 6,
      ataques: [{ nome: 'Tacape', bonus: 7, dano: [1, 10, 4], margem: 20, mult: 2, tipo: 'impacto' }], tags: ['humanoide'] },
    saqueadora: { nome: 'Saqueadora das Uivantes', nd: 1, ndTxt: '1', token: 'saqueadora', pv: 20, def: 15, fort: 4, ref: 6, von: 3, inic: 7, desloc: 6,
      ataques: [{ nome: 'Machadinha', bonus: 6, dano: [1, 6, 3], margem: 20, mult: 3, tipo: 'corte' }],
      distancia: { nome: 'Arco curto', bonus: 7, dano: [1, 6, 0], alcance: 12, margem: 20, mult: 3, tipo: 'perfuração' }, tags: ['humanoide'], aprox: true },
    soldadoPurista: { nome: 'Soldado Purista', nd: 1, ndTxt: '1', token: 'soldado-purista', pv: 18, def: 18, fort: 6, ref: 6, von: 4, inic: 6, desloc: 6,
      ataques: [{ nome: 'Espada longa', bonus: 5, dano: [1, 8, 0], margem: 19, mult: 2, tipo: 'corte' }],
      distancia: { nome: 'Besta pesada', bonus: 10, dano: [1, 12, 5], alcance: 20, margem: 19, mult: 2, tipo: 'perfuração' }, tags: ['humanoide'], tiroPreciso: true },
    cultista: { nome: 'Cultista', nd: 2, ndTxt: '2', token: 'cultista', pv: 21, def: 13, fort: 6, ref: 4, von: 12, inic: 2, desloc: 6, pm: 14, cd: 15, atrMagia: 4,
      ataques: [{ nome: 'Adaga', bonus: 5, dano: [1, 4, 1], margem: 19, mult: 2, tipo: 'perfuração' }],
      magias: ['infligirFerimentos', 'perdicao', 'amedrontar'], tags: ['humanoide'], aprox: true },
    zumbiTurba: { nome: 'Turba de Zumbis', nd: 2, ndTxt: '2', token: 'zumbi-turba', pv: 50, def: 12, fort: 9, ref: 1, von: 3, inic: -1, desloc: 4,
      ataques: [{ nome: 'Mãos podres', bonus: 9, dano: [2, 6, 4], margem: 20, mult: 2, tipo: 'impacto' }], tags: ['morto-vivo'], imune: ['mental', 'sono'], aprox: true },
    minotauro: { nome: 'Minotauro da Manada', nd: 2, ndTxt: '2', token: 'minotauro', pv: 40, def: 17, fort: 11, ref: 5, von: 4, inic: 9, desloc: 6,
      ataques: [{ nome: 'Tridente', bonus: 13, dano: [1, 8, 5], margem: 20, mult: 2, tipo: 'perfuração' }, { nome: 'Chifres', bonus: 13, dano: [1, 6, 5], margem: 20, mult: 2, tipo: 'perfuração' }], tags: ['humanoide'] },
    barbaroErmos: { nome: 'Bárbaro dos Ermos', nd: 2, ndTxt: '2', token: 'barbaro-ermos', pv: 38, def: 14, fort: 9, ref: 4, von: 2, inic: 5, desloc: 6,
      ataques: [{ nome: 'Machado', bonus: 11, dano: [1, 12, 6], margem: 20, mult: 3, tipo: 'corte' }], tags: ['humanoide'], aprox: true },
    homemPiranha: { nome: 'Homem-Piranha', nd: 2, ndTxt: '2', token: 'homem-piranha', pv: 40, def: 16, fort: 8, ref: 7, von: 3, inic: 6, desloc: 6,
      ataques: [{ nome: 'Mordida', bonus: 11, dano: [1, 8, 6], margem: 20, mult: 2, tipo: 'perfuração', frenesi: true }], tags: ['humanoide'], aprox: true },
    urso: { nome: 'Urso', nd: 3, ndTxt: '3', token: 'urso', pv: 72, def: 15, fort: 13, ref: 9, von: 5, inic: 5, desloc: 8,
      ataques: [{ nome: 'Mordida', bonus: 16, dano: [1, 8, 8], margem: 20, mult: 2, tipo: 'perfuração' }, { nome: 'Garra', bonus: 16, dano: [1, 6, 8], margem: 20, mult: 2, tipo: 'corte' }, { nome: 'Garra', bonus: 16, dano: [1, 6, 8], margem: 20, mult: 2, tipo: 'corte' }], tags: ['animal'] },
    sargentoPurista: { nome: 'Sargento Purista', nd: 3, ndTxt: '3', token: 'sargento-purista', pv: 40, def: 26, fort: 13, ref: 6, von: 12, inic: 8, desloc: 4,
      ataques: [{ nome: 'Espada longa', bonus: 13, dano: [1, 8, 9], margem: 19, mult: 2, tipo: 'corte' }, { nome: 'Espada longa', bonus: 13, dano: [1, 8, 9], margem: 19, mult: 2, tipo: 'corte' }],
      distancia: { nome: 'Besta pesada', bonus: 13, dano: [1, 12, 4], alcance: 20, margem: 19, mult: 2, tipo: 'perfuração' }, tags: ['humanoide'], tiroPreciso: true },
    arcanoGuerra: { nome: 'Arcano de Guerra', nd: 4, ndTxt: '4', token: 'arcano-de-guerra', pv: 44, def: 18, fort: 11, ref: 8, von: 10, inic: 12, desloc: 6, pm: 25, cd: 18, atrMagia: 4,
      ataques: [{ nome: 'Espada longa', bonus: 12, dano: [1, 8, 7], margem: 19, mult: 2, tipo: 'corte' }],
      magias: ['setaMilicia', 'amarras'], tags: ['humanoide'] },
    serpeJovem: { nome: 'Serpe Jovem', nd: 4, ndTxt: '4', token: 'serpe-jovem', pv: 60, def: 19, fort: 12, ref: 10, von: 6, inic: 8, desloc: 8, voo: true,
      ataques: [{ nome: 'Mordida', bonus: 14, dano: [1, 8, 8], margem: 20, mult: 2, tipo: 'perfuração' }, { nome: 'Ferrão', bonus: 14, dano: [1, 6, 6], margem: 20, mult: 2, tipo: 'perfuração', veneno: [1, 12] }], tags: ['monstro'], aprox: true },
    moggo: { nome: 'Moggo Navalha', nd: 5, ndTxt: '5', token: 'moggo', pv: 75, def: 22, fort: 8, ref: 16, von: 8, inic: 14, desloc: 6, chefe: true,
      ataques: [{ nome: 'Navalha', bonus: 16, dano: [1, 6, 8], margem: 18, mult: 2, tipo: 'corte' }, { nome: 'Navalha', bonus: 16, dano: [1, 6, 8], margem: 18, mult: 2, tipo: 'corte' }],
      furtivo: [3, 6], tags: ['humanoide'], aprox: true },
    ogra: { nome: 'Ogra', nd: 5, ndTxt: '5', token: 'ogra', pv: 95, def: 18, fort: 15, ref: 5, von: 6, inic: 3, desloc: 6, grande: true,
      ataques: [{ nome: 'Tacape grande', bonus: 17, dano: [3, 6, 12], margem: 20, mult: 2, tipo: 'impacto', derrubar: true }], tags: ['humanoide'], aprox: true },
    golem: { nome: 'Golem de Nor', nd: 6, ndTxt: '6', token: 'golem', pv: 150, def: 25, fort: 12, ref: 6, von: 8, inic: 6, desloc: 4, rd: 10,
      ataques: [{ nome: 'Pancada', bonus: 22, dano: [1, 10, 14], margem: 20, mult: 2, tipo: 'impacto', extra: [2, 6, 'eletricidade'] }, { nome: 'Pancada', bonus: 22, dano: [1, 10, 14], margem: 20, mult: 2, tipo: 'impacto', extra: [2, 6, 'eletricidade'] }],
      tags: ['construto'], imune: ['mental', 'sono', 'cansaco'] },
    serpe: { nome: 'Serpe Anciã', nd: 8, ndTxt: '8', token: 'serpe', pv: 180, def: 27, fort: 20, ref: 14, von: 12, inic: 12, desloc: 8, voo: true, chefe: true, grande: true,
      ataques: [{ nome: 'Mordida', bonus: 24, dano: [2, 8, 14], margem: 20, mult: 2, tipo: 'perfuração' }, { nome: 'Ferrão', bonus: 24, dano: [1, 8, 12], margem: 20, mult: 2, tipo: 'perfuração', veneno: [2, 12] }],
      sopro: { nome: 'Cuspe ácido', dano: [8, 6], cd: 24, recarga: 3 }, tags: ['monstro'], aprox: true },
  };

  /* ---------------- MAPAS ----------------
     . grama  T árvore (difícil, cobertura)  R pedra (bloqueia, cobertura)  W muro (bloqueia visão)
     ~ água (bloqueia)  = ponte  p trilha  t túmulo (bloqueia, cobertura)  s chão de pedra  */
  const MAPAS = {
    rio: { nome: 'Vau do Rio', tema: 'campo', linhas: [
      'TT....pp.....TTT',
      'T.....pp...R..TT',
      '......pp........',
      '..WW..pp....T...',
      '..W...pp.~~~~...',
      '......pp~~~~~~..',
      '~~~~~~==~~~~....',
      '~~~~~~==~~......',
      '..T...pp...RR...',
      '.TT...pp........',
      'TTT...pp...WW..T',
      'TT....pp....W.TT'] },
    estrada: { nome: 'Estrada de Valkaria', tema: 'campo', linhas: [
      'TTT......T..TTTT',
      'TT.............T',
      'T....R.....T....',
      'pppppppppppppppp',
      'pppppppppppppppp',
      '.....T.....R....',
      '..T.........T...',
      '.......RR.......',
      'pppppppppppppppp',
      'pppppppppppppppp',
      'T.......T....T.T',
      'TTT..T......TTTT'] },
    cripta: { nome: 'Cripta de Tauron', tema: 'cripta', linhas: [
      'WWWWWWWWWWWWWWWW',
      'Wssssssssssssss W'.replace(' ', ''),
      'WsstsssWWssstssW',
      'WssssssssssssssW',
      'WsWWssstssssWWsW',
      'WssssssssssssssW',
      'WssssssssssssssW',
      'WsWWssssstssWWsW',
      'WssssssssssssssW',
      'WsstsssWWsssstsW',
      'WssssssssssssssW',
      'WWWWWWWWWWWWWWWW'] },
    clareira: { nome: 'Clareira Sombria', tema: 'campo', linhas: [
      'TTTTT......TTTTT',
      'TTT..........TTT',
      'TT....R.........',
      'T..............T',
      '.....TT....R....',
      '......T.........',
      '.........T......',
      '....R....TT.....',
      'T..............T',
      'TT.........R..TT',
      'TTT..........TTT',
      'TTTTT......TTTTT'] },
  };
  // garante 16 colunas
  for (const k in MAPAS) MAPAS[k].linhas = MAPAS[k].linhas.map(l => (l + '................').slice(0, 16));

  /* ---------------- ESCADA DE ENCONTROS ---------------- */
  const ENCONTROS = [
    { nivel: 1, nome: 'Emboscada Kobold', mapa: 'estrada', inimigos: ['kobold', 'kobold', 'kobold', 'koboldFunda'], texto: 'Kobolds bloqueiam a estrada de Valkaria.' },
    { nivel: 2, nome: 'Uivos na Clareira', mapa: 'clareira', inimigos: ['lobo', 'lobo', 'saqueadora', 'capanga'], texto: 'Saqueadores das Uivantes e seus lobos.' },
    { nivel: 3, nome: 'A Cripta', mapa: 'cripta', inimigos: ['cultista', 'zumbi', 'zumbi', 'zumbi'], texto: 'Um cultista desperta os mortos.' },
    { nivel: 4, nome: 'Manada', mapa: 'clareira', inimigos: ['minotauro', 'barbaroErmos', 'saqueador'], texto: 'Mercenários de todo canto.' },
    { nivel: 5, nome: 'Patrulha Purista', mapa: 'estrada', inimigos: ['arcanoGuerra', 'soldadoPurista', 'soldadoPurista', 'capanga'], texto: 'A Supremacia Purista caça hereges.' },
    { nivel: 6, nome: 'Fera do Vau', mapa: 'rio', inimigos: ['urso', 'lobo', 'lobo', 'saqueadora', 'barbaroErmos'], texto: 'Um urso furioso guarda a travessia.' },
    { nivel: 7, nome: 'Navalha', mapa: 'rio', inimigos: ['moggo', 'saqueador', 'saqueadora', 'capanga', 'cultista'], texto: 'Moggo Navalha cobra o pedágio.' },
    { nivel: 8, nome: 'Ninho de Serpes', mapa: 'clareira', inimigos: ['serpeJovem', 'serpeJovem', 'zumbiTurba', 'homemPiranha'], texto: 'Serpes famintas.' },
    { nivel: 11, nome: 'O Guardião', mapa: 'cripta', inimigos: ['golem', 'arcanoGuerra', 'capanga'], texto: 'O golem desperta.' },
    { nivel: 14, nome: 'A Serpe Anciã', mapa: 'clareira', inimigos: ['serpe', 'serpeJovem', 'ogra'], texto: 'O chefe final.' },
  ];

  const DATA = { ALCANCE, CUSTO_CIRCULO, ARMAS, CLASSES, HEROIS, HABILIDADES, MAGIAS, CRIATURAS, MAPAS, ENCONTROS };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA; else root.T20DATA = DATA;
})(this);
