# Agenda de Leilões

Agenda das leiloeiras (Leiloingá, Gralha Azul, Panorama, Pampa Remates) com links do YouTube e previsão do tempo nos leilões da Leiloingá.

Site: https://leiloingaleiloes.github.io/AGENDA/ (início com os botões das áreas). Agenda em `agenda.html`, previsão do tempo em `tempo.html`.

Os dados ficam em `agenda.json`, atualizado todo dia de manhã.

Fichas dos lotes em `fichas.html`: lê o PDF da ordem de entrada no próprio navegador (pdf.js em `vendor/pdfjs`) e gera o Word com uma ficha por página. Quando só houver foto da lista, `.github/ferramentas/ordem_pdf.py` gera um PDF no mesmo formato a partir dos lotes transcritos.

Relatório dos lotes em `relatorio.html`: lê o mesmo PDF da ordem de entrada (mesma leitura do `fichas.html`) puxa os lances da Conferência Boleta do mesmo dia (localStorage `leiloinga-boleta-v1` ou `boletas/` no ADM) e soma as categorias escolhidas (idade 6/12, 12/18, 18/24, +24; brancos × cruzados; machos × fêmeas) com peso médio e R$/kg (lance × 3 ÷ peso, só vendidos). A lista padrão de brancos e cruzados fica em `RACA_PADRAO`; as escolhas feitas na tela ficam em `racas.json` no repositório privado do ADM.
