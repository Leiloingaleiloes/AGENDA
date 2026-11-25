# Sistema Leiloingá — instruções para o Claude Code

Sistema web da **Leiloingá Leilões** (leiloeira de gado em Laranjeiras do Sul-PR). Quem usa e pede as mudanças é o Rafael, que não programa. Fale sempre em **português do Brasil**, de forma direta e honesta, sem jargão técnico.

## Como trabalhar com o Rafael
- Ele pede mudanças em linguagem do dia a dia, muitas vezes várias numa mensagem só. Faça todas, teste e responda curto: o que mudou, como usar e o link para publicar.
- **Publicação:** nunca dê push direto na `main`. Crie uma branch, faça commit, dê push e abra um PR (`gh api repos/Leiloingaleiloes/<repo>/pulls ...`). Mande o link do PR e diga: "abra, clique em Merge pull request e depois em Confirm merge". Se houver mais de um PR pendente que mexe no mesmo arquivo, junte tudo num PR só, para não dar conflito.
- Quando ele perguntar onde fica algo, mande o link direto (painel: https://leiloingaleiloes.github.io/AGENDA/sistema-novo.html).
- Se não tiver certeza do que ele viu ou fez na tela, pergunte de novo. Peça print ou gravação quando algo der errado.
- Ele usa muito o **celular** e o **tablet** (deitado e em pé). Tudo precisa caber na tela, sem rolar para os lados, sem zoom e sem "efeito mola".
- Teste antes de entregar. Use um servidor local mais Playwright/Chrome e tire prints em celular (390x844), tablet (1180x820 e 820x1180) e notebook. Para mudanças grandes, peça uma revisão independente: um agente que não viu o trabalho segue um roteiro de ponta a ponta.

## Repositórios (GitHub, dono `Leiloingaleiloes`)
| Repo | O que é | Visibilidade |
|---|---|---|
| **AGENDA** | O sistema interno (painel com menu lateral). GitHub Pages: `leiloingaleiloes.github.io/AGENDA/` | público (o código é público; os dados de leilão não ficam aqui) |
| **LOTES** | Catálogo público dos produtores (lotes, fotos, vídeos, ordem de entrada). Pages: `leiloingaleiloes.github.io/LOTES/` | público |
| **ADM** | Dados privados: `boletas/`, `pos/`, `fichas.json`, `fichas-leiloes/`, `comissoes.json`, `boletas-pdf/` | privado |

Os aparelhos falam com o GitHub por uma chave guardada no navegador (localStorage `leiloinga-adm-gh`). Sem essa chave, tudo fica "só neste aparelho".

## Páginas do AGENDA (todas em HTML, CSS e JS puro, sem build)
- `sistema-novo.html` — **painel principal**. Tem menu lateral e cada área abre num iframe (`AREAS`). Grupos do menu:
  - **Geral:** Início (banners animados dos próximos leilões da Leiloingá), Agenda, Previsão do tempo.
  - **Leilão atual:** Lotes · ADM e Boleta (Início do leilão, Pista, Vendidos, Retorno).
  - **Pós-leilão:** Pós-leilão, Relatório por categoria, Comissão, Arquivo de leilões, Comparar leilões.
  - **Divulgação:** Catálogo e Propagandas.
  - Em `?publico=1` mostra só o Início, sem senha e sem menu. É o botão "Agenda" do catálogo.
- `fichas.html` — **Lotes ADM**. Barra "Leilão" no topo, com os leilões de hoje em diante mais o "🧪 Leilão de teste". Abas: Fichas (PDF da ordem de entrada → Word), Vendedores (cartões; dois cliques para editar; adicionar e excluir; anexar PDF; botão 📷), Câmera (fotos e vídeos para o site, ocultar foto, "Vídeos juntos"), Relatório, Ordem de entrada, Pedidos. Botões "Mandar lotes pro site" e "Encerrar no site".
- `boleta-nova.html` — **Boleta e Pós-leilão** (o mesmo arquivo; abas `ini, pista, V, R` = leilão atual; `rel, com, cmp` = pós-leilão).
- `relatorio-novo.html` — Relatório por categoria (faixas de peso, raça, sexo, fotos, PDF compilado).
- `arquivo-leiloes.html` — Arquivo de leilões. Só consulta: leilões antigos, vendedores, fotos e resultados.
- `tempo-novo.html`, `agenda.html`, `propagandas.html`.
- `trava.js` — senha geral do sistema e senha da Comissão (hash SHA-256; nunca escreva as senhas em arquivos).
- As páginas antigas (`index.html`, `sistema.html`, `boleta.html`, `relatorio.html`, `tempo.html`) só redirecionam para as novas.

## Regras de negócio (combinadas com o Rafael)
### Leilão atual × Pós-leilão × Teste
- **Lotes ADM manda.** O leilão é escolhido uma vez na barra "Leilão" e cada leilão tem os seus próprios lotes. Ao trocar de leilão, os lotes do anterior ficam guardados (`fichas-arquivo-v1` e `fichas-leiloes/AAAA-MM-DD.json` no ADM) e abrem os do escolhido. Lote lançado, corrigido ou excluído no Lotes ADM vai sozinho para a Boleta daquele dia.
- **Boleta:** o botão "▶ Iniciar leilão" abre o leilão escolhido no Lotes ADM. **A cada 5 lotes marcados na pista, o Pós-leilão é atualizado sozinho** ("ao vivo"). Comprador, doação, comissão e correções feitas no pós-leilão nunca são apagados por essa atualização (`paraPos` mantém o que foi editado, comparando com `P.snap`).
- **Pós-leilão:** ao abrir, nenhum leilão vem escolhido. A única exceção é o leilão de hoje já ao vivo (5 lotes ou mais). O Relatório por categoria e a Comissão usam o pós-leilão.
- **"⏹ Encerrar leilão"** (Boleta → Início do leilão) é um botão só. Ele passa o leilão para o pós-leilão como encerrado, encerra o site dos produtores (`estado.json` no LOTES, com o banner do próximo leilão) e o Lotes ADM guarda os lotes e passa para o próximo leilão. Leilão encerrado nunca pode voltar como boleta do leilão atual.
- **Teste:** fica separado (`fichas-teste-v1`, sessão `teste`). Mostra uma faixa laranja e não manda nada para a nuvem, o site nem o pós-leilão.
- **PDF da boleta** feita por outra pessoa: entra em Boleta → Início ("Boleta em PDF"). O sistema lê o PDF gerado pela própria Boleta. Se o modelo for desconhecido, guarda o PDF em `boletas-pdf/` no ADM para ensinar o sistema a ler. O Rafael vai mandar o primeiro PDF real para definir como ler vendidos e retornos.

### Valores
- Lance em R$/kg vezes 3: valor por cabeça = `lance × 3`; valor do lote = `lance × 3 × qtde`.
- **Média R$/kg = média dos lotes** (soma o R$/kg de cada lote vendido e divide pelo número de lotes). Existe a opção "por kg vendido", mas o padrão é a média dos lotes.
- **Doação:** entra no faturamento e nas médias, mas não gera comissão.
- **Comissão:** cada cidade tem o seu % do comprador e o seu % do vendedor, salvos para o próximo leilão na mesma cidade. A divisão com a Rural, a parte do leiloeiro e as demais partes estão em `calc()`, no `boleta-nova.html`. Este repositório é público: não escreva aqui valores nem percentuais pessoais. A comissão do Rafael aparece só na aba Comissão, protegida por senha (nunca na Boleta nem no PDF).

### Relatórios
- Faixas de peso: até 200, 200/250, 250/300 e +300 kg. No PDF compilado vêm primeiro os MACHOS (do mais leve ao mais pesado), depois uma linha fina e as FÊMEAS. O PDF é sucinto e não informa quantos lotes ficaram de fora.

### Fotos e site dos produtores (LOTES)
- `midia.json` guarda as fotos e vídeos; `oculta:true` esconde do site. O catálogo mostra só os lotes que têm mídia.
- As fotos ficam 30 dias em `LOTES/arquivo/AAAA-MM-DD/` (Action `arquivo-fotos.yml`). O Pós-leilão e o Arquivo mostram o botão 📷 de cada lote a partir dessa pasta.
- O banner usa a capa do YouTube (16:9) quando a transmissão está na agenda: `sddefault` primeiro, e troca para `maxresdefault` só se `naturalWidth > 200` (quando não existe, o YouTube devolve uma imagem cinza).
- Com o leilão encerrado, o catálogo mostra só o próximo leilão, sem a frase "leilão encerrado".

## Dados no navegador (localStorage)
`leiloinga-boleta-v1` (`{atual, sess, pos, posAtual, v}`), `fichas-lotes-v1` (Lotes ADM atual), `fichas-arquivo-v1`, `fichas-teste-v1`, `fichas-modo`, `leiloinga-relatorio-v1`, `relatorio-media`, `leiloinga-comissoes-v1`, `leiloinga-pisteiros`, `leiloinga-compradores`, `leiloinga-trava-*`. As páginas do painel conversam por eventos `storage` e `postMessage`.

## Automação (GitHub Actions)
- AGENDA: `banners.yml` (8h17/14h17) baixa os banners dos leilões da Leiloingá para `banners/` e atualiza `agenda.json`.
- LOTES: `arquivo-fotos.yml` (guarda as fotos por 30 dias) e `juntar-videos.yml` (botão "Juntar vídeos": `juntos/machos.mp4` e `juntos/femeas.mp4`).
- Uma tarefa agendada diária do Claude atualiza `agenda.json` (leilões da Leiloingá e de outras leiloeiras, mais o tempo).

## Testar localmente
```bash
mkdir -p /tmp/www && ln -sfn "$PWD" /tmp/www/AGENDA && ln -sfn ../LOTES /tmp/www/LOTES
cd /tmp/www && python3 -m http.server 8767
# abra http://localhost:8767/AGENDA/sistema-novo.html
# para pular a senha nos testes: localStorage 'leiloinga-trava-geral' = String(Date.now()+1e9)
```
Confira sempre:
- erros de JS (`node --check` nos `<script>` e `pageerror` no navegador);
- se a página não passa da largura da tela no celular;
- se os dados de um leilão não aparecem em outro.
