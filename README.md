# ⚔️ Arena de Arton

Simulador de combate tático por turnos de **Tormenta 20**, direto no navegador. Grátis, sem cadastro, sem backend.

**▶ Jogar:** https://arena-de-arton.vercel.app · **🌴 Portfólio:** https://javaijafoi.vercel.app

## O que tem
- Grade 16×12 (1,5 m por quadrado), visão de cima, movimento e alcance destacados
- 9 heróis e magias até o 4º círculo
- Escada de 10 encontros (níveis 1 a 14), inimigos controlados por IA (ou você controla os dois lados)
- Manobras (agarrar, empurrar, derrubar, escapar), voo, cegueira, ataque de oportunidade opcional
- Desfazer movimento, previsão de combate, placar de dano, sons gerados no navegador
- Motor de regras (`js/rules.js`) separado da interface (`js/ui.js`), pensado para reaproveitar

## Rodar
Abra `index.html` (ou sirva a pasta com qualquer servidor estático). Testes sem dependências:

```bash
node test/sim.js 30       # IA x IA na escada de encontros
node test/magias.js       # lança todas as magias
node test/mecanicas.js    # voo, cegueira, manobras
```

## Sobre imagens e licença
- **Código:** MIT (veja `LICENSE`).
- **Sem arte oficial:** as ilustrações de *Tormenta20* pertencem à Jambô Editora e são reservadas, então este repositório **não as inclui**. Os personagens usam emblemas gerados. Quem tiver o material pode colocar retratos em `tokens/<id>.jpg` apenas localmente (a pasta é ignorada pelo git).
- **Homenagem de fã:** projeto gratuito, sem fins lucrativos, **não oficial** e não aprovado nem apoiado pela Jambô Editora. *Tormenta20*, o cenário de Arton e seus nomes pertencem à [Jambô Editora](https://jamboeditora.com.br). Regras implementadas de forma simplificada; algumas fichas são aproximações.

## 🌴 Mais do Peter
Veja os outros projetos no [portfólio](https://javaijafoi.vercel.app).
