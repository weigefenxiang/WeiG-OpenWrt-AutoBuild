# Wei.G OpenWrt — personalização de firmware online

Escolha o dispositivo e os pacotes no navegador, envie o pedido pelo GitHub e deixe a compilação do firmware OpenWrt a cargo da nuvem.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Adaptado a dispositivos móveis · 🌙 Temas claro e escuro · ✅ Compatível com várias distribuições baseadas em OpenWrt**

**[🌐 Abrir o configurador](https://www.weigshare.com/wrt/) · [⬇️ Transferir firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Distribuições suportadas:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Idioma:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · **Português** · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Mais idiomas</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Pré-visualização da interface

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt no computador" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt no telemóvel" width="21.30%">
</p>

## Primeiros passos: firmware personalizado em três etapas

**📖 [Guia ilustrado completo](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Selecionar código-fonte, dispositivo e pacotes

Abra o [**【Configurador online】**](https://www.weigshare.com/wrt/) e escolha, por ordem, **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Selecione as funcionalidades pretendidas em **【② Selecionar pacotes】** e ajuste **【Advanced menuconfig】**, fuso horário e tema, se necessário.

Se já tiver uma configuração, clique em **【Carregar configuração】** e importe `build-request.json`, `.config` ou `config.buildinfo`. Confirme a origem, o dispositivo e os pacotes antes de continuar.

### 2. Enviar a compilação para o GitHub

Primeiro, [**【inicie sessão no GitHub】**](https://github.com/login). Regresse ao [**【Configurador】**](https://www.weigshare.com/wrt/) e clique em **【Submeter compilação na nuvem】** → **【Transferir pedido e abrir o GitHub】**. O navegador transfere um ficheiro `*.json` e abre um formulário de Issue. Num computador, arraste o JSON para o campo do pedido e clique em **【Submit new issue】**.

Depois de enviar o Issue, o bot responde com uma ligação para a compilação.

<details>
<summary><strong>Informações importantes (expandir)</strong></summary>

> **Sugestão:** Pode verificar antecipadamente a configuração e as sugestões de compatibilidade com **【Testar】**, na barra flutuante no canto inferior direito. A opção **【Transferir pedido e abrir o GitHub】** também efetua esta verificação automaticamente.
>
> Se forem encontrados problemas, aplique a solução proposta ou escolha **【Manter e continuar à força】**. Continuar à força não corrige eventuais erros no código a montante nem garante uma compilação bem-sucedida.
>
> Utilize a página de Issue aberta pelo próprio configurador para não perder os dados preenchidos automaticamente.
>
> Transferir o JSON sem enviar o Issue **não inicia a compilação**.
>
> Não publique palavras-passe reais, tokens ou outros dados sensíveis em Issues públicos, pedidos ou registos.

</details>

### 3. Transferir o firmware

Siga a ligação apresentada no Issue ou procure a execução em [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Após a conclusão, transfira o firmware em **【Artifacts】**, no fundo da página. `CONFIG` contém definições e `BUILD-LOGS` contém registos de diagnóstico: **nenhum destes ficheiros serve para instalar firmware**. As transferências ficam disponíveis durante **60 dias**.

## Perguntas frequentes

<details>
<summary>Porque é que muitos pacotes podem esgotar o espaço RootFS?</summary>

Os pacotes e as respetivas dependências podem ultrapassar a capacidade da partição RootFS. Se o dispositivo permitir, procure `TARGET_ROOTFS_PARTSIZE` em **【Advanced menuconfig】** → **【Target Images】** e ajuste a capacidade, por exemplo para 512 ou 1024 MiB. Alguns routers físicos não permitem alterar este valor devido à memória flash e ao esquema de partições; nestes casos, reduza os pacotes. Consulte o [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Porque é que a compilação termina por exceder o tempo?</summary>

Um Job num runner alojado pelo GitHub tem normalmente um máximo de seis horas. Este projeto limita o Job a **350 minutos** e a execução da compilação a **335 minutos**, reservando tempo para recolher os registos. Ao atingir o limite, a compilação **pára; não fica suspensa para retomar mais tarde**. Dependências grandes, como Node.js ou Rust, podem aumentar o tempo necessário.

</details>

<details>
<summary>Como investigar uma compilação falhada?</summary>

Transfira `BUILD-LOGS` em **【Artifacts】** e comece por `00-SUMMARY.txt`. Verifique se a causa é a capacidade RootFS, um limite de tempo, o código a montante ou conflitos entre dependências. Consulte o [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Depois de corrigir a configuração, crie **um novo Issue**.

</details>

<details>
<summary>Posso repetir um Run antigo depois de alterar a configuração?</summary>

Não para testar as alterações. Uma execução antiga mantém o pedido, o código e os dados que ficaram associados à origem. Carregue e verifique a configuração atualizada no site e envie um pedido novo.

</details>

## Desenvolvimento e implementação

Para utilizar o serviço não é necessário clonar o repositório nem instalar Node.js. Os responsáveis pelo projeto podem consultar o [guia de desenvolvimento (em inglês)](../docs/DEVELOPER.md) e a [documentação da arquitetura (em inglês)](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

O [Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) recolhe e publica ramos de código, perfis dos dispositivos, pacotes, dependências Kconfig e dados de compatibilidade, usados pelo site e pelo serviço de compilação. Assim, o AutoBuild não mantém uma segunda base de dados de dispositivos e pacotes.

## Agradecimentos

Agradecemos a [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) e aos [autores dos pacotes e colaboradores](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licença

Este projeto é disponibilizado ao abrigo da [GNU GPLv3](../LICENSE) ou posterior. Informações sobre direitos de autor e contactos em [NOTICE](../NOTICE).
