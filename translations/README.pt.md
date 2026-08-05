# WeiG-OpenWrt-AutoBuild

![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-f7df1e?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Semantic-e34f26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-No_Framework-1572b6?logo=css3&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Tooling-339933?logo=nodedotjs&logoColor=white)
![Shell](https://img.shields.io/badge/Shell-Bash-4eaa25?logo=gnubash&logoColor=white)
![YAML](https://img.shields.io/badge/YAML-GitHub_Actions-cb171e?logo=yaml&logoColor=white)

**Language**: [简体中文](../README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md) · [Русский](README.ru.md) · [Español](README.es.md) · Português (Brasil) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch (Sie)](README.de.md) · [Français (vous)](README.fr.md) · [Tiếng Việt](README.vi.md)

**Personalização online + compilação na nuvem** de firmware OpenWrt. Escolha o código-fonte, escolha a versão e marque os plugins em uma página web; o GitHub Actions compila automaticamente e você baixa o firmware gratuitamente.

Atualmente o **360T7 (MT7981)** é o modelo com manutenção completa; os mais de 200 outros modelos da página estão abertos em **modo semente** (garantia apenas no nível "consegue dar boot", sem validação em hardware real — use por sua conta e risco; a forma de promovê-los ao nível de manutenção completa está descrita na seção para mantenedores, mais abaixo).

⭐ **Uma Star é o maior apoio que você pode dar — suas Stars são a minha motivação para continuar atualizando!**

- Página de personalização (site principal): <https://wrt.weigefenxiang.cc.cd>
- Página de personalização (cópia de reserva no blog): <https://www.weigeshare.cc.cd/wrt/>
- Três linhas de produção de código-fonte: [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [OpenWrt oficial](https://github.com/openwrt/openwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **Branches de versão**: todos os branches remotos do ImmortalWrt são indexados. O OpenWrt inclui `main` e todos os branches `openwrt-*`, exceto `lede-17.01`, `pcs-standalone-back` e `master`. A página gera uma configuração separada por fonte, branch e perfil de dispositivo e mostra apenas combinações que realmente existem no upstream.
- A interface suporta **11 idiomas** (chinês simplificado / chinês tradicional / inglês / russo / espanhol / português / japonês / coreano / alemão / francês / vietnamita), acompanha automaticamente o idioma do navegador e pode ser trocada manualmente no canto superior direito; quando falta uma tradução, ela recorre automaticamente ao inglês

---

## Sou usuário: como personalizar o firmware

1. Abra a página, escolha **Source → Branch → Target System → Subtarget → Target Profile → plugins** e informe um identificador de build.
2. Clique em **Enviar compilação na nuvem → Baixar solicitação e abrir o GitHub**. Envie somente o `build-request.json` recém-baixado e clique em **Create**; não é preciso preencher dispositivo, fonte, versão ou partição. Carregue antes na página qualquer `.config` ou `config.buildinfo` existente para identificar o dispositivo.
3. O bot responderá na Issue com o link deste build; a compilação completa leva cerca de **2 a 3 horas**.
4. Quando o build terminar, o bot avisará em um novo comentário. Abra a página do build e baixe na seção **Artifacts**, no final da página:
   - `data-nome-original.img.gz`: cada imagem final diretamente e sem ZIP; a primeira gravação normalmente usa `factory`;
   - `data-CONFIG`: configurações enviada/efetiva e metadados;
   - `data-BUILD-LOGS`: logs completos e erros, mantidos por 14 dias;
   - `data-OPTIONAL-PACKAGES` / `data-FIRMWARE-OTHER`: pacotes M e arquivos auxiliares.
5. Para não compilar, escolha **Enviar compilação na nuvem → Baixar apenas .config**. Actions só executa `make defconfig` quando o usuário ativa **Defconfig**; caso contrário, o `.config` completo continua sendo a entrada oficial. As opções obrigatórias só são aplicadas após confirmação.
6. A página carrega `build-request.json`, `.config` e `config.buildinfo`. O campo de fuso horário pesquisa a lista IANA completa do OpenWrt/LuCI no formato uniforme `(UTC±HH:MM) Region/City`; também permite escolher tema LuCI, NTP e espelho opkg.

> 💡 Depois de gravar o firmware: acesse **192.168.1.1** no navegador (ou o endereço que você personalizou na página de envio), usuário **root**; **a senha fica em branco** (defina uma imediatamente no primeiro login) — apenas na fonte Lean LEDE a senha inicial é `password`.
>
> 💡 No canto superior direito da página há um botão de **autodiagnóstico**: com um clique ele testa a acessibilidade das fontes de dados (três níveis: local / jsDelivr / raw), a lógica de geração do .config e a conectividade com o GitHub. Se a página não carregar corretamente, clique nele primeiro para investigar.
>
> 💡 Ao marcar um plugin com dependências (como o assistente de divisão de tráfego MWAN3), os plugins pré-requisitos são marcados automaticamente para você; dependências no nível de kernel/bibliotecas são resolvidas automaticamente na compilação — não é preciso se preocupar.
>
> ⚠️ Para baixar os Artifacts é obrigatório estar conectado ao GitHub. Firmware, configuração e informações do build ficam disponíveis por 30 dias; `BUILD-LOGS`, por 14 dias.
>
> ⚠️ Gravar firmware envolve riscos. A variante de **partição grande de 108M** exige que você já tenha gravado o U-Boot "à prova de brick" (ubootmod); a variante de **partição de fábrica** grava direto sem alterar as partições, mas tem pouco espaço — marcar plugins demais fará a compilação falhar ou o firmware não caber.

### Encontrando seu firmware no Actions

A lista de builds segue o padrão de nomes `Build 定制 · 你的标识 · 源码 版本/变体` — basta procurar pelo identificador que você preencheu: repositório → **Actions** → **custom-build**.

## Fork e compilação por conta própria

Se você não quer esperar na fila do repositório público, ou quer alterar a configuração padrão, pode fazer tudo sozinho:

1. Clique em **Fork** no canto superior direito para copiar este repositório para a sua conta;
2. No seu Fork, vá em **Settings → Features e marque Issues**; depois, na **página Actions, clique no botão verde para habilitar os workflows**;
3. De volta à página de personalização, no passo ④ escolha **Meu próprio Fork** e informe seu nome de usuário do GitHub; a partir daí, os builds que você enviar rodarão na sua própria cota gratuita;
4. A página baixa `build-request.json` e abre um Issue com um único anexo obrigatório. Envie o arquivo; o Actions usa diretamente o `.config` completo contido nele, sem recriá-lo a partir do base config do repositório.

## Sou mantenedor: como adicionar plugins / alterar configurações

Fluxo de dados: `config/<marca>/<modelo>/*.config` é mantido para importar configurações antigas e solicitações históricas (o 360T7 possui atualmente 14 configurações de fonte/ramo/Profile). Os novos parâmetros de compilação vêm dinamicamente do `WeiG-OpenWrt-Menuconfig-Catalog`; cada compilação por Issue usa como entrada final o `.config` completo exportado em `build-request.json`.

### Adicionando uma nova opção de plugin

1. Confirme que as quatro configurações base já contêm a linha `# CONFIG_PACKAGE_luci-app-xxx is not set` do pacote (se não houver, o pacote não existe nos feeds daquela fonte — adicione primeiro o feed no script diy e atualize a configuração base);
2. Adicione uma entrada ao array `plugins` de `tools/plugins-meta.json`: `{ "id": "xxx", "name": "nome em chinês", "group": "grupo", "desc": "descrição de uma linha", "size": 2, "hot": false }` (se o nome do pacote diferir do sufixo `luci-app-` ou variar entre as três fontes, adicione um campo `pkgs` com o mapeamento explícito; se houver plugins pré-requisitos no nível luci-app, adicione `requires: ["id-do-pre-requisito"]` e a página fará a marcação encadeada automaticamente);
3. Execute `node tools/gen-plugins.mjs`; o script regenera `site/wrt/data/360t7/plugins.json`, mantém as configurações base autoritativas apenas em `config/` e emite avisos sobre plugins que "existem na configuração mas não foram catalogados";
4. Faça commit e push. A página não precisa de nenhuma alteração de código — a nova opção aparece automaticamente.

### Habilitando / adicionando um modelo de roteador

O catálogo de modelos fica em `site/wrt/data/devices.json`, organizado por marca; o 360T7 está no nível de manutenção completa e os demais modelos ficam em **modo semente** (sources gerados a partir de template, tabela de plugins semente compartilhada, garantia apenas de conseguir dar boot). Passos para promover um modelo semente ao nível de manutenção completa:

1. Localize o modelo em `devices.json` e preencha `sources` conforme a realidade (para cada fonte: nome do arquivo de config, branches em versions, variantes em variants e pares de substituição de partição);
2. Coloque as configurações base de cada fonte em `config/<marca>/<id-do-modelo>/`, seguindo a convenção de nomes `<marca>_<modelo>_<fonte>.config` (o repositório já traz, para a maioria dos modelos, configurações semente "mínimas que dão boot" — contendo apenas o dispositivo alvo + LuCI — que podem ser usadas diretamente ou servir de base para acrescentar mais);
3. Execute `node tools/gen-plugins.mjs` (ele gera um plugins.json próprio para cada modelo habilitado);
4. Teste de fumaça: rode uma compilação na nuvem para cada fonte e confirme que as imagens são geradas.

Zero alterações no código da página e do workflow; o parâmetro `device` continua sendo validado contra a lista de permissões, como sempre.

### Estrutura de diretórios e arquitetura técnica

Veja [ARCHITECTURE.md](../ARCHITECTURE.md) (bilíngue, chinês e inglês).

### Segurança

- Issues aceitam 1–3 anexos hospedados no GitHub e detectam `build-request.json`, `.config` e `config.buildinfo`; campos, listas permitidas, tamanho, assinatura do alvo e opções obrigatórias da fonte são validados. A configuração completa é a entrada oficial por padrão; `make defconfig` roda uma única vez apenas quando Defconfig é ativado explicitamente, protegendo Target, Profile, arquitetura e pacotes obrigatórios.
- O identificador de build (tag) é sanitizado para conter apenas caracteres chineses e latinos, dígitos e hífens, sendo usado somente para nomear e exibir o artifact;
- As permissões do workflow são restritas a `contents: read + issues: write`.

### Convenção de manutenção multilíngue da documentação

**Sempre que este README (ou qualquer md voltado ao usuário) for modificado, a versão correspondente de cada idioma em `translations/` deve ser atualizada em sincronia**; o mesmo vale para a documentação de desenvolvedor (`docs/DEVELOPER.md` ↔ `docs/DEVELOPER.en.md`). Esta é uma regra rígida, para evitar que as versões nos vários idiomas divirjam.

## Agradecimentos

Obrigado a todos os projetos de código aberto e autores que contribuíram, direta ou indiretamente, para este projeto:

- **Código-fonte**: [OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **Infraestrutura**: [GitHub Actions](https://github.com/features/actions) (compilação na nuvem) · [Cloudflare Pages](https://pages.cloudflare.com/) (hospedagem do site reserva)
- **Todos os autores dos <!--plugin-count-->242<!--/plugin-count--> plugins LuCI**, bem como projetos do ecossistema como o LuCI, o Hexo e o tema Butterfly;
- Cada usuário que abre uma Issue, relata um problema ou dá uma Star.

Este projeto apenas orquestra e invoca os projetos acima; todos os direitos autorais pertencem aos seus respectivos autores.
