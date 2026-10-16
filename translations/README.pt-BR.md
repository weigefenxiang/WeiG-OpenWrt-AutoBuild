# Wei.G OpenWrt — personalize seu firmware online

Escolha seu dispositivo e os pacotes pelo navegador, envie uma solicitação pelo GitHub e deixe a nuvem compilar seu firmware OpenWrt.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Funciona no celular · 🌙 Temas claro e escuro · ✅ Suporte a várias distribuições baseadas em OpenWrt**

**[🌐 Abrir o configurador](https://www.weigshare.com/wrt/) · [⬇️ Baixar firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Distribuições compatíveis:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Idioma:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Mais idiomas</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; **Português (Brasil)** &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Prévia da interface

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Primeiros passos: seu firmware em três etapas

**📖 [Tutorial completo com imagens](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Escolha a origem, o dispositivo e os pacotes

Abra o [**【Configurador online】**](https://www.weigshare.com/wrt/) e escolha **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Selecione os pacotes desejados e ajuste **【Advanced menuconfig】**, fuso horário e tema, se necessário. Você também pode usar **【Carregar configuração】** para importar `build-request.json`, `.config` ou `config.buildinfo`. Confira os dados antes de continuar.

### 2. Envie uma compilação pelo GitHub

Primeiro, [**【entre na sua conta do GitHub】**](https://github.com/login). Volte ao [**【Configurador】**](https://www.weigshare.com/wrt/) e clique em **【Enviar compilação na nuvem】** → **【Baixar solicitação e abrir GitHub】**. Um arquivo `*.json` será baixado e o formulário de Issue será aberto. No computador, arraste o JSON para o campo da solicitação e clique em **【Submit new issue】**. O robô responderá com o link para acompanhar a compilação.

<details>
<summary><strong>Avisos importantes (clique para expandir)</strong></summary>

> Use **【Testar】** na barra flutuante no canto inferior direito para verificar problemas de configuração e recomendações de compatibilidade. A checagem também acontece automaticamente ao gerar a solicitação.
>
> Se houver problemas, aplique a correção sugerida ou escolha **【Manter e continuar mesmo assim】**. Forçar a continuação não corrige falhas no código original e a compilação ainda pode falhar.
>
> Use o formulário do GitHub Issue aberto automaticamente pelo configurador para preservar os dados já preenchidos.
>
> Apenas baixar o JSON **não inicia a compilação**. É necessário enviar o Issue.
>
> Não publique senhas reais, tokens ou outras informações confidenciais em Issues públicos, solicitações ou logs.

</details>

### 3. Baixe o firmware

Acesse o link do Issue ou procure a execução em [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Quando a compilação terminar, baixe o firmware em **【Artifacts】**, no fim da página. `CONFIG` contém as configurações e `BUILD-LOGS` contém logs de diagnóstico — **nenhum deles é uma imagem de firmware para instalação**. Os arquivos ficam disponíveis por **60 dias**.

## Perguntas frequentes

<details>
<summary>Por que muitos pacotes podem deixar o RootFS sem espaço?</summary>

Pacotes e dependências podem ultrapassar o tamanho da partição RootFS. Se o dispositivo permitir, procure `TARGET_ROOTFS_PARTSIZE` em **【Advanced menuconfig】** → **【Target Images】** e ajuste para 512 ou 1024 MiB, conforme a necessidade. Alguns roteadores físicos têm partições flash fixas; nesse caso, remova pacotes. Veja o [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Por que a compilação para por limite de tempo?</summary>

Um Job em um runner hospedado pelo GitHub normalmente tem limite de seis horas. O projeto define **350 minutos** por Job e encerra a execução aos **335 minutos** para reservar tempo aos logs. A compilação **é encerrada, não pausada para continuar depois**. Dependências grandes, como Node.js e Rust, podem demorar bastante.

</details>

<details>
<summary>Como investigar uma compilação com falha?</summary>

Baixe `BUILD-LOGS` em **【Artifacts】** e confira primeiro `00-SUMMARY.txt`. Verifique espaço RootFS, tempo, erros de código-fonte e dependências. Veja o [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Depois de corrigir a configuração, crie **outro Issue**.

</details>

<details>
<summary>Posso executar um Run antigo com uma configuração nova?</summary>

Não. Ele ainda usa a solicitação original e o código e os dados fixados naquela execução. Carregue a configuração atual no site e crie um novo pedido.

</details>

## Desenvolvimento e implantação

Você não precisa clonar o repositório nem instalar Node.js para usar o site. Os detalhes técnicos estão no [guia do desenvolvedor](../docs/DEVELOPER.md) e na [documentação de arquitetura](ARCHITECTURE/ARCHITECTURE.md), ambos em inglês.

## Menuconfig Catalog

O [Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) publica branches, perfis de dispositivos, pacotes, dependências Kconfig e dados de compatibilidade usados pelo site e pela compilação. O AutoBuild não mantém outro banco de dispositivos e pacotes.

## Agradecimentos

Agradecemos a [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [e a todos os autores de pacotes e colaboradores](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licença

Este projeto usa a licença [GNU GPLv3 ou posterior](../LICENSE). Direitos autorais e contato: [NOTICE](../NOTICE).
