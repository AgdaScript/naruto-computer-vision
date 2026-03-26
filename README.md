# Naruto Computer Vision — Kage Bunshin no Jutsu

Demonstração web que usa a **câmara** e **visão computacional** para detetar um gesto inspirado no selo do *Kage Bunshin* (Naruto) e mostrar um efeito de “clones” em volta da figura recortada do utilizador.

## O que faz

1. **Captura de vídeo** em tempo real (webcam).
2. **MediaPipe Hands** — segue até duas mãos e desenha o esqueleto (landmarks) sobre o canvas.
3. **Motor de gesto** — analisa um buffer de frames e procura o padrão “selo em cruz”: índice e médio estendidos, anel e mindinho mais fechados, pulsos próximos e barras das mãos aproximadamente perpendiculares em 2D.
4. **MediaPipe Selfie Segmentation** — gera máscara da pessoa; o recorte é combinado com o frame para desenhar **quatro clones** espelhados à esquerda e à direita, com brilho verde chakra.
5. **Interface** — texto do jutsu, flash discreto no ecrã, cantos HUD, vinheta e scanline (tema “chakra / sci-fi”).

## Tecnologias

| Área | Tecnologia |
|------|------------|
| Estrutura | HTML5 |
| Estilo | CSS3 (`@font-face`, variáveis, gradientes, `backdrop-filter` onde aplicável) |
| Lógica | JavaScript (ES6+), sem framework |
| Gráficos | Canvas 2D API (`getContext('2d')`) |
| Câmara & pipeline | **MediaPipe** via CDN (jsDelivr) |
| Modelos | `@mediapipe/hands`, `@mediapipe/selfie_segmentation`, `@mediapipe/camera_utils` |
| Tipografia | Fonte **Ninja Naruto** (`font/njnaruto.ttf`) — ver `font/readme.txt` para licença e créditos |

### MediaPipe (resumo)

- **Hands** — deteção e tracking de landmarks 3D das mãos (21 pontos por mão).
- **Selfie Segmentation** — máscara binária pessoa vs. fundo; usada para recortar a silhueta e alimentar o efeito dos clones.
- **Camera Utils** — classe `Camera` que liga o `<video>` ao envio de frames para os grafos do MediaPipe.

Os ficheiros `.wasm` e modelos são carregados automaticamente a partir do pacote npm no CDN (`locateFile`).

## Estrutura do projeto

```
naruto-computer-vision/
├── kagebunshin.html   # Página principal
├── kagebunshin.css    # Estilos e tema visual
├── kagebunshin.js     # Gestos, MediaPipe, canvas, efeitos
├── font/
│   ├── njnaruto.ttf
│   └── readme.txt     # Licença e informação da fonte
└── README.md
```

## Como executar
1. Abrir no browser: `http://localhost:{PORT}/kagebunshin.html` (ajusta a porta ao comando usado).
2. **Permitir acesso à câmara** quando o browser pedir.

Recomenda-se Chrome ou Edge recentes; em Safari podem aplicar-se limitações extra à câmara ou ao WebGL usado pelo MediaPipe.

## Requisitos

- Browser com **getUserMedia**, **Canvas** e **WebAssembly** (para os modelos MediaPipe).
- Conexão à internet na **primeira carga** (scripts e modelos via CDN), salvo que configures cópias locais dos pacotes `@mediapipe/*`.

## Privacidade

O processamento é feito **no cliente** (no teu browser). Não há servidor próprio no repositório a gravar vídeo; apenas o fluxo que o MediaPipe precisa para inferência.

## Créditos

- *Naruto* / elementos de marca: propriedade dos respetivos titulares; este projeto é uma demonstração educacional e de entretenimento sem afiliação oficial.
- Fonte Ninja Naruto: autores e termos em `font/readme.txt`.
