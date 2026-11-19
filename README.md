# Arcieri Amiconi

App della squadra: allenamenti, gare, sagome 3D, statistiche, simulatore di volo, lettura del bersaglio da foto e video, analisi del gesto.

## Com'è fatta

- **Sito** (cartella `src/`): TanStack Start + React, database Postgres, accesso con utente e password.
- **APK Android** (cartella `apk/`): un guscio Capacitor che apre il sito pubblicato e aggiunge fotocamera, salvataggio dei file con «Condividi» e tasto indietro.

## Avere l'APK

1. Nel repository, **Settings → Secrets and variables → Actions → Variables → New variable**:
   `APP_URL` = l'indirizzo del sito pubblicato (inizia con `https://`).
2. **Actions → APK Android → Run workflow** (oppure basta una modifica su `main`).
3. Dopo qualche minuto l'APK è in **Releases**: dal telefono scarica `arcieri-amiconi.apk`, aprilo e consenti l'installazione.

### Firma (facoltativa, per aggiornare senza disinstallare)

Senza firma l'APK è "di prova": ogni versione nuova va installata dopo aver tolto la vecchia.
Con una chiave fissa gli aggiornamenti si installano sopra. In **Secrets** aggiungi:

- `ANDROID_KEYSTORE_BASE64`: il file `.keystore` in base64
- `ANDROID_KEYSTORE_PASSWORD`: la password
- `ANDROID_KEY_ALIAS`: l'alias della chiave

Una chiave si crea con:
`keytool -genkeypair -v -keystore arcieri.keystore -alias arcieri -keyalg RSA -keysize 2048 -validity 10000`
e poi `base64 -w0 arcieri.keystore`. Conservala: senza la stessa chiave non si può più aggiornare l'app.

## Sviluppo del sito

```
npm install
npm run dev        # http://localhost:8080
npm run typecheck
npm run build
```

Servono le variabili d'ambiente del database e dell'accesso (vedi `src/lib/env.server.ts`).
