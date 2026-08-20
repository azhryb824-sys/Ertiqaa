# Ertiqaa encrypted recovery backup

- Snapshot date: 2026-08-17
- Encrypted file: `ertiqaa-storage-2026-08-17.json.enc`
- Cipher: AES-256-CBC, PBKDF2-SHA256, 600000 iterations
- Plaintext SHA-256: `dcf62b6e66ab762d87368cb8bb54f6848c34efba4f1d8f7afafb3d01d2c667e5`
- Encrypted SHA-256: `d9a45f95fa821f38b2c682808150efed63bcf70e34764661478a77461193c943`
- Contents checked before encryption: 33 storage keys, 25 contracts, 276 visits, 4 users.

The decryption key is intentionally stored outside this public repository.

```sh
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 \
  -in ertiqaa-storage-2026-08-17.json.enc \
  -out ertiqaa-storage-2026-08-17.json \
  -pass file:/secure/path/ertiqaa-recovery-key.txt
```
