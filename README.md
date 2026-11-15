# 🐒 Macacadas Map

App Android para a galera compartilhar a localização em tempo real e ver por onde cada um passou.

## O que tem

- **Mapa ao vivo** com a posição de cada amigo e o rastro do dia
- **Histórico** de qualquer dia (guardado pra sempre), por pessoa ou todo mundo, com km andados e horário
- **Perfil**: nome, cor do rastro, botão de pausar o compartilhamento e código de convite do grupo
- Funciona com a **tela bloqueada** (aparece uma notificação fixa enquanto compartilha)
- Pontos feitos **sem internet** ficam guardados e são enviados depois

## Como instalar

1. Vá em **Releases** (lado direito da página do repositório) e baixe o `.apk` mais novo.
2. Mande o arquivo pros amigos (WhatsApp, Drive...) ou o link da página de Releases.
3. No Android, abra o arquivo e permita "instalar apps desconhecidos" quando pedir.
4. Na permissão de localização, escolha **"Permitir o tempo todo"**.
5. Se o rastro parar sozinho: Configurações → Apps → Macacadas Map → Bateria → **Sem restrições**.

## Atualizações

Cada `push` na branch `main` gera um APK novo automaticamente (GitHub Actions → "Gerar APK")
e publica em Releases. A primeira linha da mensagem do commit vira o texto de "novidades".

Quando alguém abre o app, ele consulta a última Release e, se tiver versão mais nova, mostra
"Atualização disponível". Um toque baixa o APK; é só abrir e instalar por cima (o login continua).
Isso precisa que o repositório seja **público** (a API do GitHub não deixa baixar Releases de repositório privado sem login).

## Primeiro uso

1. Um de vocês cria a conta e toca em **Criar grupo novo**.
2. Na aba **Perfil** aparece o código de convite: mande pros outros.
3. Os outros criam a conta e entram com o código.

## Como é feito

| Parte | Tecnologia |
|---|---|
| App | React Native + Expo (SDK 58), TypeScript |
| Mapa | Leaflet dentro de um WebView, mapa da CARTO/OpenStreetMap (sem chave de API) |
| Localização | `expo-location` + `expo-task-manager` (serviço em primeiro plano) |
| Servidor | Supabase: login, banco Postgres com PostGIS, tempo real |

### Banco (pasta `supabase/migrations`)

- `profiles`, `groups`, `group_members`, `locations`
- Regras RLS: cada um só vê quem está no mesmo grupo; só manda ponto se o compartilhamento estiver ligado
- Toda madrugada (04:17) um job simplifica os rastros dos dias anteriores, mantendo só os pontos que desenham o caminho. Isso economiza espaço pro histórico eterno caber no plano grátis.

## Rodar no PC (desenvolvimento)

```bash
npm install
npx expo prebuild --platform android
npx expo run:android
```

O app usa código nativo (rastreamento em segundo plano), então **não funciona no Expo Go**.
