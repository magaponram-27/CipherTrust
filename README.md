# CipherTrust

CipherTrust is a browser-based chat demo with end-to-end encrypted text and image messages, JWT-authenticated real-time relay, and an on-device scan for known AI-generator metadata. The metadata scan is not a deepfake classifier and cannot determine whether an image is authentic. The server persists ciphertext, its IV, routing metadata, the image MIME type, and optional scan metadata. It has no decryption key.

> **Security and detection caveats:** This is a learning/demo project, not a professionally audited messaging product. The image check only looks for known AI-generator text markers in image data; markers can be removed or forged, and many AI images contain none. It cannot detect deepfakes reliably or prove an image is real. Local content safety checks use text patterns and an adult-image classifier; they can miss harmful content or flag harmless content, and do not reliably detect violence, self-harm, hateful imagery, or every form of adult content. They are not a guarantee or a substitute for moderation. There is no forward secrecy, key verification, rate limiting, or account recovery. Use HTTPS in production and do not reuse sensitive passwords.

## Project layout

- `backend/` — Express API, MongoDB models, JWT auth, and Socket.IO relay.
- `frontend/` — React/Vite PWA, Web Crypto encryption, and on-device image analysis.

## Requirements

- Node.js 20 or newer and npm.
- A MongoDB Atlas database or local MongoDB instance.

## Run locally

1. In `backend/`, copy `.env.example` to `.env`, set `MONGO_URI` and a long random `JWT_SECRET`, then run:

   ```powershell
   npm install
   npm run dev
   ```

   The health endpoint is `http://localhost:5000/` and should return `{"status":"ok"}`.

2. In `frontend/`, copy `.env.example` to `.env` (the default API URL is `http://localhost:5000`), then run:

   ```powershell
   npm install
   npm run dev
   ```

   Open the Vite URL it prints. For two-party testing, use two accounts in separate browsers or private windows. Sign in at least once on each account so their public ECDH keys are available. In each account's Contacts sidebar, add the other person's exact username; each account has its own private contacts list. Then select the contact and send messages.

3. Make a production frontend bundle with `npm run build` from `frontend/`.

## Encryption design

The password is never sent to the backend. PBKDF2-SHA-256 (100,000 iterations, username-derived salt) creates a local AES-256-GCM vault key. A P-256 ECDH identity is generated in the browser; its public half is published, while its private half is encrypted with the vault key before being stored locally. Both conversation participants derive the same AES-GCM key from ECDH and each other's public key. Each message and image uses a fresh random 96-bit IV.

The server authenticates API and socket connections, enforces the sender identity from the JWT, and stores/relays opaque ciphertext. Image bytes are encrypted directly with AES-GCM before base64 encoding for transport, avoiding an unnecessary base64-to-text-to-ciphertext conversion. New image records include a MIME type so recipients can decrypt the bytes; older data-URL encrypted images remain readable. Usernames, timestamps, message type, image MIME type, and the optional AI-metadata scan result are not encrypted. The demo stores a long-lived ECDH identity in that browser profile; losing its local encrypted identity or using another device prevents decrypting existing messages. Sign-in will not silently replace an already-registered public key when the local identity is missing or different, since doing so would make existing conversations undecryptable. Verify public keys out-of-band in a real application to prevent key-substitution attacks.

## Deployment

### Full-stack deployment on Render

The root `render.yaml` deploys the API and frontend together as a Render Blueprint. Before deploying, create a MongoDB Atlas cluster and database user, and allow the Render service to connect. Then open [Render's Blueprint creation page](https://dashboard.render.com/blueprint/new?repo=https%3A%2F%2Fgithub.com%2Fmagaponram-27%2FCipherTrust), connect this repository, and enter the Atlas connection string for `MONGO_URI` when prompted. The Blueprint generates `JWT_SECRET` and configures the frontend to use `https://ciphertrust-api.onrender.com`. After both services finish deploying, Render provides the public frontend URL.

The free API instance can take a short time to wake after inactivity. Keep Atlas credentials private; do not commit them to the repository.

### MongoDB Atlas

1. Create an M0 cluster and a dedicated database user.
2. Configure Atlas network access to allow the Render service to connect. `0.0.0.0/0` is convenient for a demo, but restrict access where possible.
3. Copy the URI and replace the username/password placeholders. Keep credentials private.

### Backend on Render

1. Push the project to a GitHub repository and create a Render **Web Service**.
2. Set **Root Directory** to `ciphertrust/backend` (or `backend` if the repository root is already the `ciphertrust` folder).
3. Set **Build Command** to `npm install` and **Start Command** to `npm start`.
4. Add environment variables `MONGO_URI` and `JWT_SECRET`; Render provides `PORT`.
5. Deploy and verify the service root URL returns `{"status":"ok"}`. Copy the HTTPS URL.

### Frontend on Vercel

1. Import the repository as a Vercel project.
2. Set **Root Directory** to `ciphertrust/frontend` (or `frontend` if the repository root is already the `ciphertrust` folder) and select Vite.
3. Set `VITE_API_URL` to the deployed Render URL (for example, `https://your-service.onrender.com`), without a trailing slash.
4. Deploy. Socket.IO and API calls use this configured URL.
5. Open the HTTPS site on desktop and phone. The web manifest and service worker enable PWA installation and cache the app shell; encrypted conversations still require a network connection.

## Viva demo script

1. Open the hosted app in two browser profiles and register `alice` and `bob`.
2. Explain that login derives an AES vault key in the browser and unlocks a device-local private ECDH identity; only the public key goes to the server.
3. In each profile, add the other account by exact username from the Contacts sidebar. Contact lists are account-specific; users are not shown the entire user directory.
4. Select the other user and send text both ways. Point out instant socket delivery, then reload to show conversation history is fetched from MongoDB and decrypted locally.
5. Send an image. Explain that the browser checks locally for known AI-generator metadata markers and encrypts the raw image bytes before sending. The metadata scan is not a deepfake classifier; an absent marker does not establish authenticity.
6. Show a stored message document: it has `from`, `to`, `ciphertext`, `iv`, type and optional verdict metadata, but no plaintext or image bytes.
7. Log out, sign in again in the same browser profile, and show that the private identity can be unlocked using the password.
8. For honest security discussion, note that this demo has no key verification or forward secrecy; do not claim its heuristic proves an image is real.

## Notes

- `.env` files should never be committed; only `.env.example` files belong in the repository.
- The backend accepts Socket.IO messages up to 10 MB. Images are locally resized or optimized when needed to fit the 6 MB encrypted-transfer limit; HEIC/HEIF photos are converted to JPEG when the browser can decode them.
- Image sending shows local safety-check, encryption, and server-acknowledged delivery stages. The chat header reports the realtime connection state. The image metadata scan runs on-device and does not upload or retain image plaintext.
- New messages in other conversations show an in-app alert and an unread count. Optional browser notifications can be enabled from the Contacts panel; they are created only by the signed-in recipient's app, contain no message text or sender name, and require browser permission. While the app is open and connected, tapping a notification opens the sender's conversation and scrolls to the message. Notifications do not arrive after the browser has closed. Visibility on a shared device is still controlled by the browser and operating-system notification settings.
- Text messages are checked on-device for suspicious links, including known URL shorteners, lookalike brand domains, encoded lookalike characters, embedded URL credentials, raw IP addresses, risky top-level domains, redirects, and sign-in, dashboard, or verification pages on unrecognized domains. Every detected link shows a result: flagged links show the reasons, while other links say no obvious phishing patterns were found. That is not proof a site is safe; checks are local heuristics, not a live reputation lookup, and may flag legitimate links. Treat unknown links cautiously and verify destinations independently.
- Senders can unsend a delivered message for everyone. The server deletes the message record, and connected participants remove it immediately; it will also be absent from history when offline participants next load the conversation. Unsend cannot erase content someone has already read, copied, or captured outside the app.
- Swipe a message horizontally on a touch device, or open its message actions and choose Reply, to quote it and focus the composer. Reply text and its quoted preview are included in the encrypted message content. The composer includes a categorized emoji picker that stays open for multiple selections, with a Done & send action to send the accumulated draft and return focus to the composer, plus a sticker panel; emojis, stickers, and reply metadata are sent as part of the encrypted message.
- Users can block/unblock contacts. A block in either direction prevents the backend from saving or relaying new messages and typing indicators; old conversation history remains. Before encryption and after decryption, the browser applies a local text-pattern filter for selected adult, self-harm, violent-threat, harassment, and hateful-abuse phrases. Images are checked locally with NSFWJS/TensorFlow.js for selected sexual-content classes before sending and before display; the checker reduces images to model size and falls back to CPU inference on browsers without WebGL. If the check cannot run, the image is not sent or shown, and the error includes the underlying reason. Image data is not uploaded to a moderation service. Neither mechanism can catch all harmful material; in particular, image violence and other non-sexual harms are not comprehensively screened, and text pattern matching is not a full language moderation model.
- Web Crypto requires a secure context; localhost and HTTPS hosting are supported.
- Browser encryption identities are stored per site origin. Always use the same address consistently (for example, `http://localhost:5173`, not sometimes `http://127.0.0.1:5173`); switching origins creates a different local key store and can make old messages impossible to decrypt from that origin. Do not clear the browser's CipherTrust site data if you need its saved identity.
