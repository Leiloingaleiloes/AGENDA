# Agenda de Leilões

Agenda das leiloeiras (Leiloingá, Gralha Azul, Panorama, Pampa Remates) com links do YouTube e previsão do tempo nos leilões da Leiloingá.

Site: https://leiloingaleiloes.github.io/AGENDA/ (início com os botões das áreas). Agenda em `agenda.html`, previsão do tempo em `tempo.html`.

Os dados ficam em `agenda.json`, atualizado todo dia de manhã.

Fichas dos lotes em `fichas.html`: lê o PDF da ordem de entrada no próprio navegador (pdf.js em `vendor/pdfjs`) e gera o Word com uma ficha por página. Quando só houver foto da lista, `.github/ferramentas/ordem_pdf.py` gera um PDF no mesmo formato a partir dos lotes transcritos.
