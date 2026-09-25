(() => {
  'use strict';

  const STORAGE_KEY = 'sendzero_language';
  const DEFAULT_LANGUAGE = 'en';
  const SUPPORTED = ['en', 'de', 'pl'];

  const messages = {
    en: {
      meta_title_home: 'SendZero — private file sharing',
      meta_description: 'Encrypt in your browser. Share a link. The server never receives the decryption key.',
      meta_title_download: 'Receive with SendZero',
      meta_title_terms: 'SendZero — Terms of Use',
      terms_pill: 'acceptable use',
      terms_eyebrow: 'TERMS OF USE',
      terms_title: 'Use SendZero responsibly.',
      terms_intro: 'SendZero is for lawful private file transfers. By uploading or sharing a transfer, you agree to these rules.',
      terms_1_title: '1. Your responsibility',
      terms_1_text: 'You are responsible for the files you upload, the links you share, and ensuring that you have the right to distribute the content.',
      terms_2_title: '2. Prohibited content and activity',
      terms_2_intro: 'Do not use SendZero to upload, distribute, facilitate, or promote:',
      terms_prohibited_illegal: 'content whose possession or distribution is illegal;',
      terms_prohibited_csam: 'child sexual abuse material or any sexual exploitation of minors;',
      terms_prohibited_ncii: 'non-consensual intimate imagery or sexual exploitation of any person;',
      terms_prohibited_malware: 'malware, ransomware, spyware, phishing kits, credential stealers, or other malicious code;',
      terms_prohibited_stolen: 'stolen credentials, unlawfully obtained personal data, doxxing material, or leaked private data;',
      terms_prohibited_threats: 'credible threats, extortion, stalking, targeted harassment, or material used to facilitate violence;',
      terms_prohibited_ip: 'content that unlawfully infringes copyright, trademark, privacy, or other rights;',
      terms_prohibited_abuse: 'spam, fraud, scams, abusive automated use, attacks on the service, or attempts to bypass its security and limits.',
      terms_3_title: '3. Encrypted service',
      terms_3_text: 'SendZero encrypts files in the browser and does not normally possess the decryption key. This privacy design does not grant permission to use the service for prohibited activity.',
      terms_4_title: '4. Abuse and enforcement',
      terms_4_text: 'Transfers may be blocked or deleted when there is a reasonable basis to believe they violate these rules, threaten the service, or must be restricted to comply with applicable law. Technical information and abuse reports may be used for this purpose.',
      terms_5_title: '5. Not a backup service',
      terms_5_text: 'SendZero is a temporary transfer service. Files may expire, be deleted, become unavailable, or be lost. Keep your own copy of anything important.',
      terms_6_title: '6. Service availability',
      terms_6_text: 'The service is provided on an as-available basis. Limits, retention periods, features, and these terms may change as the service evolves.',
      terms_7_title: '7. Reporting abuse',
      terms_7_text: 'When reporting a suspected abusive transfer, provide the SendZero transfer URL and a clear description of the issue. Do not include the decryption key unless it is necessary for the report.',
      terms_note: 'These are basic service rules and an acceptable-use policy. They do not replace any mandatory rights or obligations under applicable law.',
      terms_link: 'Terms',
      upload_terms: 'By uploading, you agree to the Terms and confirm that the file does not contain prohibited content.',
      back_home: 'Back to SendZero',
      home_aria: 'SendZero home',
      pill_home: 'zero-access transfer',
      pill_download: 'encrypted transfer',
      eyebrow_home: 'PRIVATE FILE SHARING',
      hero_line1: 'Send a file.',
      hero_line2: 'Reveal nothing.',
      hero_text: 'Your file is encrypted locally before upload. The decryption key stays in the share link fragment and is never sent to SendZero.',
      choose_file: 'Choose a file',
      drop_file: 'or drop it here · max 5 GiB',
      expires_after: 'Expires after',
      ttl_1h: '1 hour',
      ttl_24h: '24 hours',
      ttl_7d: '7 days',
      one_time: 'One-time download',
      one_time_desc: 'Delete server copy after the first completed transfer.',
      encrypt_upload: 'Encrypt & upload',
      preparing: 'Preparing…',
      ready: 'READY',
      private_link: 'Your private link',
      private_link_desc: 'Anyone with the complete link can decrypt the file. The part after # is the key.',
      copy: 'Copy',
      copied: 'Copied',
      send_another: 'Send another file',
      trust_encrypt_title: 'Chunked client-side encryption',
      trust_encrypt_desc: 'AES-256-GCM via Web Crypto. Up to 5 GiB.',
      trust_account_title: 'No account',
      trust_account_desc: 'No sign-up is required.',
      trust_key_title: 'No key on server',
      trust_key_desc: 'The URL fragment never reaches PHP.',
      footer_private: 'Private file sharing',

      download_eyebrow: 'PRIVATE TRANSFER',
      opening_link: 'Opening secure link…',
      checking_payload: 'Checking the encrypted payload.',
      encrypted_file: 'Encrypted file',
      decrypt_save: 'Decrypt & save',
      downloading_data: 'Downloading encrypted data…',

      file_too_large: 'File is too large',
      max_size: 'Maximum size is 5 GiB.',
      checking_file: 'Checking file…',
      checking_interrupted: 'checking for interrupted upload…',
      interrupted_upload_found: 'interrupted upload found',
      resume_upload: 'Resume upload',
      could_not_prepare: 'Could not prepare this file.',
      previous_upload_expired: 'Previous upload expired. Creating a new transfer…',
      preparing_transfer: 'Preparing encrypted transfer…',
      saved_key_invalid: 'Saved encryption key is invalid. Start a new transfer.',
      resuming_upload_existing: 'Resuming upload · {done}/{total} chunks already on server',
      uploading_progress: '{mode}… {pct}% · {done}/{total} chunks',
      mode_resuming: 'Resuming',
      mode_uploading: 'Encrypting & uploading',
      finalizing_transfer: 'Finalizing transfer…',
      expires: 'expires {date}',
      one_time_enabled: 'one-time download enabled',
      upload_paused: 'Upload paused: {error} · choose the same file later to resume.',
      error: 'Error: {error}',

      transfer_cannot_open: 'This transfer cannot be opened',
      cannot_recover_key: 'SendZero cannot recover a missing or incorrect decryption key.',
      invalid_transfer_id: 'The transfer ID is invalid.',
      missing_key: 'The decryption key is missing from the link.',
      invalid_key: 'Invalid decryption key',
      expired_transfer: 'This transfer has expired.',
      transfer_missing: 'This transfer no longer exists.',
      manifest_unavailable: 'The encrypted manifest is unavailable.',
      metadata_mismatch: 'Transfer metadata does not match.',
      interrupted_download_found: 'Interrupted download found',
      can_continue_download: 'SendZero can continue writing to the same local file from the last verified encrypted chunk.',
      resume_download: 'Resume download',
      already_saved: '{size} · {pct}% already saved · next chunk {next}/{total}',
      encrypted_ready: 'Encrypted file ready',
      one_time_ready_desc: 'This is a one-time transfer. The server copy is removed after a completed download.',
      chunk_decrypt_desc: 'The file will be decrypted chunk by chunk in this browser.',
      encrypted_meta: '{size} · {total} encrypted chunks · expires {date}',
      permission_partial: 'Permission to the partial local file is required to resume.',
      partial_shorter: 'The partial local file is shorter than the last verified checkpoint.',
      streaming_prepare_failed: 'Streaming download could not be prepared.',
      streaming_start_failed: 'Streaming download did not start.',
      streaming_interrupted: 'Streaming download interrupted.',
      streaming_close_failed: 'Streaming download did not close cleanly.',
      browser_large_unsupported: 'This browser cannot stream a file this large to disk. Use a current browser with File System Access support.',
      reopening_partial: 'Reopening partial local file…',
      preparing_save: 'Preparing local save…',
      resuming_download_progress: 'Resuming download… {pct}% · chunk {current}/{total}',
      downloading_progress: '{mode}… {pct}% · chunk {current}/{total}',
      mode_downloading: 'Downloading & decrypting',
      chunk_download_failed: 'Chunk {current} could not be downloaded.',
      decrypted_saved: 'Decrypted. Your file has been saved.',
      transfer_complete: 'Transfer complete',
      one_time_removed: 'The one-time encrypted server copy has been removed.',
      decrypted_local: 'The file was decrypted only in this browser.',
      save_cancelled: 'Save cancelled.',
      resume_state_cleared: '{error} The saved resume state was cleared; start the download again.',
      start_again: 'Start download again',
      download_paused: 'Download paused at {pct}%. Open this link again and choose Resume download.',
      webcrypto_unsupported: 'This browser does not support the Web Crypto API.'
    },

    de: {
      meta_title_home: 'SendZero — privater Dateiversand',
      meta_description: 'Im Browser verschlüsseln. Link teilen. Der Server erhält niemals den Entschlüsselungsschlüssel.',
      meta_title_download: 'Mit SendZero empfangen',
      meta_title_terms: 'SendZero — Nutzungsbedingungen',
      terms_pill: 'zulässige Nutzung',
      terms_eyebrow: 'NUTZUNGSBEDINGUNGEN',
      terms_title: 'Nutze SendZero verantwortungsvoll.',
      terms_intro: 'SendZero ist für rechtmäßige private Dateiübertragungen bestimmt. Mit dem Hochladen oder Teilen eines Transfers stimmst du diesen Regeln zu.',
      terms_1_title: '1. Deine Verantwortung',
      terms_1_text: 'Du bist für die hochgeladenen Dateien, die von dir geteilten Links und dafür verantwortlich, dass du zur Verbreitung der Inhalte berechtigt bist.',
      terms_2_title: '2. Verbotene Inhalte und Aktivitäten',
      terms_2_intro: 'SendZero darf nicht verwendet werden, um Folgendes hochzuladen, zu verbreiten, zu erleichtern oder zu fördern:',
      terms_prohibited_illegal: 'Inhalte, deren Besitz oder Verbreitung rechtswidrig ist;',
      terms_prohibited_csam: 'Darstellungen sexuellen Missbrauchs von Kindern oder jede sexuelle Ausbeutung Minderjähriger;',
      terms_prohibited_ncii: 'nicht einvernehmliche intime Aufnahmen oder sexuelle Ausbeutung irgendeiner Person;',
      terms_prohibited_malware: 'Malware, Ransomware, Spyware, Phishing-Kits, Credential-Stealer oder andere schädliche Software;',
      terms_prohibited_stolen: 'gestohlene Zugangsdaten, rechtswidrig erlangte personenbezogene Daten, Doxxing-Material oder geleakte private Daten;',
      terms_prohibited_threats: 'glaubhafte Drohungen, Erpressung, Stalking, gezielte Belästigung oder Material zur Ermöglichung von Gewalt;',
      terms_prohibited_ip: 'Inhalte, die Urheberrechte, Markenrechte, Datenschutzrechte oder andere Rechte rechtswidrig verletzen;',
      terms_prohibited_abuse: 'Spam, Betrug, Scams, missbräuchliche Automatisierung, Angriffe auf den Dienst oder Versuche, Sicherheitsmaßnahmen und Limits zu umgehen.',
      terms_3_title: '3. Verschlüsselter Dienst',
      terms_3_text: 'SendZero verschlüsselt Dateien im Browser und besitzt den Entschlüsselungsschlüssel normalerweise nicht. Dieses Datenschutzdesign erlaubt keine verbotene Nutzung des Dienstes.',
      terms_4_title: '4. Missbrauch und Maßnahmen',
      terms_4_text: 'Transfers können gesperrt oder gelöscht werden, wenn ein nachvollziehbarer Grund für die Annahme besteht, dass sie gegen diese Regeln verstoßen, den Dienst gefährden oder aufgrund geltenden Rechts eingeschränkt werden müssen. Technische Informationen und Missbrauchsmeldungen können hierfür verwendet werden.',
      terms_5_title: '5. Kein Backup-Dienst',
      terms_5_text: 'SendZero ist ein temporärer Dateiübertragungsdienst. Dateien können ablaufen, gelöscht werden, nicht verfügbar sein oder verloren gehen. Bewahre eigene Kopien wichtiger Dateien auf.',
      terms_6_title: '6. Verfügbarkeit des Dienstes',
      terms_6_text: 'Der Dienst wird nach Verfügbarkeit bereitgestellt. Limits, Aufbewahrungszeiten, Funktionen und diese Bedingungen können sich mit der Weiterentwicklung des Dienstes ändern.',
      terms_7_title: '7. Missbrauch melden',
      terms_7_text: 'Bei einer Meldung eines mutmaßlich missbräuchlichen Transfers gib die SendZero-Transfer-URL und eine klare Beschreibung des Problems an. Übermittle den Entschlüsselungsschlüssel nur, wenn er für die Meldung erforderlich ist.',
      terms_note: 'Dies sind grundlegende Nutzungsregeln und eine Acceptable-Use-Policy. Zwingende Rechte und Pflichten nach geltendem Recht bleiben unberührt.',
      terms_link: 'Regeln',
      upload_terms: 'Mit dem Hochladen stimmst du den Regeln zu und bestätigst, dass die Datei keine verbotenen Inhalte enthält.',
      back_home: 'Zurück zu SendZero',
      home_aria: 'SendZero Startseite',
      pill_home: 'Zero-Access-Transfer',
      pill_download: 'verschlüsselter Transfer',
      eyebrow_home: 'PRIVATER DATEIVERSAND',
      hero_line1: 'Datei senden.',
      hero_line2: 'Nichts preisgeben.',
      hero_text: 'Deine Datei wird vor dem Upload lokal verschlüsselt. Der Entschlüsselungsschlüssel bleibt im Fragment des Freigabelinks und wird niemals an SendZero gesendet.',
      choose_file: 'Datei auswählen',
      drop_file: 'oder hier ablegen · max. 5 GiB',
      expires_after: 'Läuft ab nach',
      ttl_1h: '1 Stunde',
      ttl_24h: '24 Stunden',
      ttl_7d: '7 Tagen',
      one_time: 'Einmaliger Download',
      one_time_desc: 'Serverkopie nach dem ersten vollständig abgeschlossenen Download löschen.',
      encrypt_upload: 'Verschlüsseln & hochladen',
      preparing: 'Vorbereitung…',
      ready: 'BEREIT',
      private_link: 'Dein privater Link',
      private_link_desc: 'Jeder mit dem vollständigen Link kann die Datei entschlüsseln. Der Teil nach # ist der Schlüssel.',
      copy: 'Kopieren',
      copied: 'Kopiert',
      send_another: 'Weitere Datei senden',
      trust_encrypt_title: 'Verschlüsselung im Browser',
      trust_encrypt_desc: 'AES-256-GCM über Web Crypto. Bis zu 5 GiB.',
      trust_account_title: 'Kein Konto',
      trust_account_desc: 'Keine Registrierung erforderlich.',
      trust_key_title: 'Kein Schlüssel auf dem Server',
      trust_key_desc: 'Das URL-Fragment erreicht PHP niemals.',
      footer_private: 'Privater Dateiversand',

      download_eyebrow: 'PRIVATER TRANSFER',
      opening_link: 'Sicheren Link öffnen…',
      checking_payload: 'Verschlüsselte Daten werden geprüft.',
      encrypted_file: 'Verschlüsselte Datei',
      decrypt_save: 'Entschlüsseln & speichern',
      downloading_data: 'Verschlüsselte Daten werden geladen…',

      file_too_large: 'Datei ist zu groß',
      max_size: 'Maximale Größe: 5 GiB.',
      checking_file: 'Datei wird geprüft…',
      checking_interrupted: 'unterbrochener Upload wird gesucht…',
      interrupted_upload_found: 'unterbrochener Upload gefunden',
      resume_upload: 'Upload fortsetzen',
      could_not_prepare: 'Die Datei konnte nicht vorbereitet werden.',
      previous_upload_expired: 'Der vorherige Upload ist abgelaufen. Neuer Transfer wird erstellt…',
      preparing_transfer: 'Verschlüsselter Transfer wird vorbereitet…',
      saved_key_invalid: 'Der gespeicherte Verschlüsselungsschlüssel ist ungültig. Starte einen neuen Transfer.',
      resuming_upload_existing: 'Upload wird fortgesetzt · {done}/{total} Chunks bereits auf dem Server',
      uploading_progress: '{mode}… {pct}% · {done}/{total} Chunks',
      mode_resuming: 'Fortsetzen',
      mode_uploading: 'Verschlüsseln & hochladen',
      finalizing_transfer: 'Transfer wird abgeschlossen…',
      expires: 'läuft ab: {date}',
      one_time_enabled: 'einmaliger Download aktiviert',
      upload_paused: 'Upload pausiert: {error} · wähle später dieselbe Datei aus, um fortzufahren.',
      error: 'Fehler: {error}',

      transfer_cannot_open: 'Dieser Transfer kann nicht geöffnet werden',
      cannot_recover_key: 'SendZero kann einen fehlenden oder falschen Entschlüsselungsschlüssel nicht wiederherstellen.',
      invalid_transfer_id: 'Die Transfer-ID ist ungültig.',
      missing_key: 'Der Entschlüsselungsschlüssel fehlt im Link.',
      invalid_key: 'Ungültiger Entschlüsselungsschlüssel',
      expired_transfer: 'Dieser Transfer ist abgelaufen.',
      transfer_missing: 'Dieser Transfer existiert nicht mehr.',
      manifest_unavailable: 'Das verschlüsselte Manifest ist nicht verfügbar.',
      metadata_mismatch: 'Die Transfer-Metadaten stimmen nicht überein.',
      interrupted_download_found: 'Unterbrochener Download gefunden',
      can_continue_download: 'SendZero kann ab dem letzten bestätigten verschlüsselten Chunk in dieselbe lokale Datei weiterschreiben.',
      resume_download: 'Download fortsetzen',
      already_saved: '{size} · {pct}% bereits gespeichert · nächster Chunk {next}/{total}',
      encrypted_ready: 'Verschlüsselte Datei bereit',
      one_time_ready_desc: 'Dies ist ein einmaliger Transfer. Die Serverkopie wird nach einem vollständig abgeschlossenen Download gelöscht.',
      chunk_decrypt_desc: 'Die Datei wird in diesem Browser Chunk für Chunk entschlüsselt.',
      encrypted_meta: '{size} · {total} verschlüsselte Chunks · läuft ab: {date}',
      permission_partial: 'Zum Fortsetzen ist die Berechtigung für die teilweise gespeicherte lokale Datei erforderlich.',
      partial_shorter: 'Die teilweise gespeicherte lokale Datei ist kürzer als der letzte bestätigte Prüfpunkt.',
      streaming_prepare_failed: 'Der Streaming-Download konnte nicht vorbereitet werden.',
      streaming_start_failed: 'Der Streaming-Download konnte nicht gestartet werden.',
      streaming_interrupted: 'Der Streaming-Download wurde unterbrochen.',
      streaming_close_failed: 'Der Streaming-Download wurde nicht sauber beendet.',
      browser_large_unsupported: 'Dieser Browser kann eine so große Datei nicht direkt auf die Festplatte streamen. Verwende einen aktuellen Browser mit File System Access.',
      reopening_partial: 'Teilweise gespeicherte Datei wird erneut geöffnet…',
      preparing_save: 'Lokales Speichern wird vorbereitet…',
      resuming_download_progress: 'Download wird fortgesetzt… {pct}% · Chunk {current}/{total}',
      downloading_progress: '{mode}… {pct}% · Chunk {current}/{total}',
      mode_downloading: 'Herunterladen & entschlüsseln',
      chunk_download_failed: 'Chunk {current} konnte nicht heruntergeladen werden.',
      decrypted_saved: 'Entschlüsselt. Die Datei wurde gespeichert.',
      transfer_complete: 'Transfer abgeschlossen',
      one_time_removed: 'Die einmalige verschlüsselte Serverkopie wurde gelöscht.',
      decrypted_local: 'Die Datei wurde nur in diesem Browser entschlüsselt.',
      save_cancelled: 'Speichern abgebrochen.',
      resume_state_cleared: '{error} Der gespeicherte Fortsetzungsstatus wurde gelöscht; starte den Download erneut.',
      start_again: 'Download erneut starten',
      download_paused: 'Download bei {pct}% pausiert. Öffne diesen Link erneut und wähle „Download fortsetzen“.',
      webcrypto_unsupported: 'Dieser Browser unterstützt die Web Crypto API nicht.'
    },

    pl: {
      meta_title_home: 'SendZero — prywatne wysyłanie plików',
      meta_description: 'Szyfruj w przeglądarce. Udostępnij link. Serwer nigdy nie otrzymuje klucza deszyfrującego.',
      meta_title_download: 'Odbierz przez SendZero',
      meta_title_terms: 'SendZero — Regulamin',
      terms_pill: 'zasady korzystania',
      terms_eyebrow: 'REGULAMIN',
      terms_title: 'Korzystaj z SendZero odpowiedzialnie.',
      terms_intro: 'SendZero służy do legalnego, prywatnego przesyłania plików. Wysyłając plik lub udostępniając transfer, akceptujesz te zasady.',
      terms_1_title: '1. Twoja odpowiedzialność',
      terms_1_text: 'Odpowiadasz za przesyłane pliki, udostępniane linki oraz za to, aby mieć prawo do rozpowszechniania danych treści.',
      terms_2_title: '2. Zabronione treści i działania',
      terms_2_intro: 'Nie używaj SendZero do przesyłania, rozpowszechniania, ułatwiania ani promowania:',
      terms_prohibited_illegal: 'treści, których posiadanie lub rozpowszechnianie jest nielegalne;',
      terms_prohibited_csam: 'materiałów przedstawiających seksualne wykorzystywanie dzieci ani jakiegokolwiek seksualnego wykorzystywania małoletnich;',
      terms_prohibited_ncii: 'intymnych materiałów udostępnianych bez zgody osoby przedstawionej ani seksualnego wykorzystywania jakiejkolwiek osoby;',
      terms_prohibited_malware: 'malware, ransomware, spyware, zestawów phishingowych, programów wykradających dane logowania ani innego złośliwego kodu;',
      terms_prohibited_stolen: 'skradzionych danych logowania, bezprawnie pozyskanych danych osobowych, materiałów doxxingowych ani wycieków prywatnych danych;',
      terms_prohibited_threats: 'wiarygodnych gróźb, wymuszeń, stalkingu, ukierunkowanego nękania ani materiałów służących do ułatwiania przemocy;',
      terms_prohibited_ip: 'treści bezprawnie naruszających prawa autorskie, znaki towarowe, prywatność lub inne prawa;',
      terms_prohibited_abuse: 'spamu, oszustw, scamów, nadużyć automatycznych, ataków na usługę ani prób obchodzenia jej zabezpieczeń i limitów.',
      terms_3_title: '3. Usługa szyfrowana',
      terms_3_text: 'SendZero szyfruje pliki w przeglądarce i co do zasady nie posiada klucza deszyfrującego. Ta architektura prywatności nie daje zgody na używanie usługi do działań zabronionych.',
      terms_4_title: '4. Nadużycia i egzekwowanie zasad',
      terms_4_text: 'Transfer może zostać zablokowany lub usunięty, jeżeli istnieją uzasadnione podstawy, by sądzić, że narusza te zasady, zagraża usłudze albo musi zostać ograniczony w celu spełnienia wymogów prawa. W tym celu mogą być wykorzystywane informacje techniczne i zgłoszenia nadużyć.',
      terms_5_title: '5. To nie jest usługa backupu',
      terms_5_text: 'SendZero jest tymczasową usługą przesyłania plików. Pliki mogą wygasnąć, zostać usunięte, stać się niedostępne lub zostać utracone. Zachowuj własną kopię ważnych danych.',
      terms_6_title: '6. Dostępność usługi',
      terms_6_text: 'Usługa jest świadczona w miarę dostępności. Limity, okresy przechowywania, funkcje oraz te zasady mogą się zmieniać wraz z rozwojem serwisu.',
      terms_7_title: '7. Zgłaszanie nadużyć',
      terms_7_text: 'Zgłaszając podejrzany transfer, podaj adres transferu SendZero oraz jasny opis problemu. Nie podawaj klucza deszyfrującego, chyba że jest to konieczne do rozpatrzenia zgłoszenia.',
      terms_note: 'To podstawowe zasady korzystania z usługi i polityka dopuszczalnego użycia. Nie zastępują one bezwzględnie obowiązujących praw i obowiązków wynikających z właściwych przepisów.',
      terms_link: 'Regulamin',
      upload_terms: 'Wysyłając plik, akceptujesz Regulamin i potwierdzasz, że plik nie zawiera zabronionych treści.',
      back_home: 'Wróć do SendZero',
      home_aria: 'Strona główna SendZero',
      pill_home: 'transfer zero-access',
      pill_download: 'szyfrowany transfer',
      eyebrow_home: 'PRYWATNE WYSYŁANIE PLIKÓW',
      hero_line1: 'Wyślij plik.',
      hero_line2: 'Nie ujawniaj nic.',
      hero_text: 'Twój plik jest szyfrowany lokalnie przed wysłaniem. Klucz deszyfrujący pozostaje we fragmencie linku i nigdy nie jest wysyłany do SendZero.',
      choose_file: 'Wybierz plik',
      drop_file: 'lub upuść go tutaj · maks. 5 GiB',
      expires_after: 'Wygasa po',
      ttl_1h: '1 godzinie',
      ttl_24h: '24 godzinach',
      ttl_7d: '7 dniach',
      one_time: 'Jednorazowe pobranie',
      one_time_desc: 'Usuń kopię z serwera po pierwszym poprawnie zakończonym pobraniu.',
      encrypt_upload: 'Szyfruj i wyślij',
      preparing: 'Przygotowywanie…',
      ready: 'GOTOWE',
      private_link: 'Twój prywatny link',
      private_link_desc: 'Każdy, kto ma pełny link, może odszyfrować plik. Część po # jest kluczem.',
      copy: 'Kopiuj',
      copied: 'Skopiowano',
      send_another: 'Wyślij kolejny plik',
      trust_encrypt_title: 'Szyfrowanie w przeglądarce',
      trust_encrypt_desc: 'AES-256-GCM przez Web Crypto. Do 5 GiB.',
      trust_account_title: 'Bez konta',
      trust_account_desc: 'Rejestracja nie jest wymagana.',
      trust_key_title: 'Brak klucza na serwerze',
      trust_key_desc: 'Fragment adresu URL nigdy nie trafia do PHP.',
      footer_private: 'Prywatne wysyłanie plików',

      download_eyebrow: 'PRYWATNY TRANSFER',
      opening_link: 'Otwieranie bezpiecznego linku…',
      checking_payload: 'Sprawdzanie zaszyfrowanych danych.',
      encrypted_file: 'Zaszyfrowany plik',
      decrypt_save: 'Odszyfruj i zapisz',
      downloading_data: 'Pobieranie zaszyfrowanych danych…',

      file_too_large: 'Plik jest za duży',
      max_size: 'Maksymalny rozmiar to 5 GiB.',
      checking_file: 'Sprawdzanie pliku…',
      checking_interrupted: 'szukanie przerwanego wysyłania…',
      interrupted_upload_found: 'znaleziono przerwany upload',
      resume_upload: 'Wznów wysyłanie',
      could_not_prepare: 'Nie udało się przygotować pliku.',
      previous_upload_expired: 'Poprzedni upload wygasł. Tworzenie nowego transferu…',
      preparing_transfer: 'Przygotowywanie szyfrowanego transferu…',
      saved_key_invalid: 'Zapisany klucz szyfrujący jest nieprawidłowy. Rozpocznij nowy transfer.',
      resuming_upload_existing: 'Wznawianie uploadu · {done}/{total} fragmentów jest już na serwerze',
      uploading_progress: '{mode}… {pct}% · {done}/{total} fragmentów',
      mode_resuming: 'Wznawianie',
      mode_uploading: 'Szyfrowanie i wysyłanie',
      finalizing_transfer: 'Finalizowanie transferu…',
      expires: 'wygasa: {date}',
      one_time_enabled: 'włączone jednorazowe pobranie',
      upload_paused: 'Upload wstrzymany: {error} · wybierz później ten sam plik, aby wznowić.',
      error: 'Błąd: {error}',

      transfer_cannot_open: 'Nie można otworzyć tego transferu',
      cannot_recover_key: 'SendZero nie może odzyskać brakującego lub nieprawidłowego klucza deszyfrującego.',
      invalid_transfer_id: 'Identyfikator transferu jest nieprawidłowy.',
      missing_key: 'W linku brakuje klucza deszyfrującego.',
      invalid_key: 'Nieprawidłowy klucz deszyfrujący',
      expired_transfer: 'Ten transfer wygasł.',
      transfer_missing: 'Ten transfer już nie istnieje.',
      manifest_unavailable: 'Zaszyfrowany manifest jest niedostępny.',
      metadata_mismatch: 'Metadane transferu są niespójne.',
      interrupted_download_found: 'Znaleziono przerwane pobieranie',
      can_continue_download: 'SendZero może kontynuować zapis do tego samego pliku lokalnego od ostatniego zweryfikowanego fragmentu.',
      resume_download: 'Wznów pobieranie',
      already_saved: '{size} · zapisano {pct}% · następny fragment {next}/{total}',
      encrypted_ready: 'Zaszyfrowany plik jest gotowy',
      one_time_ready_desc: 'To transfer jednorazowy. Kopia na serwerze zostanie usunięta po poprawnie zakończonym pobraniu.',
      chunk_decrypt_desc: 'Plik zostanie odszyfrowany fragment po fragmencie w tej przeglądarce.',
      encrypted_meta: '{size} · {total} zaszyfrowanych fragmentów · wygasa: {date}',
      permission_partial: 'Do wznowienia potrzebna jest zgoda na dostęp do częściowo zapisanego pliku lokalnego.',
      partial_shorter: 'Częściowo zapisany plik lokalny jest krótszy niż ostatni zweryfikowany punkt wznowienia.',
      streaming_prepare_failed: 'Nie udało się przygotować pobierania strumieniowego.',
      streaming_start_failed: 'Nie udało się uruchomić pobierania strumieniowego.',
      streaming_interrupted: 'Pobieranie strumieniowe zostało przerwane.',
      streaming_close_failed: 'Pobieranie strumieniowe nie zostało poprawnie zakończone.',
      browser_large_unsupported: 'Ta przeglądarka nie może zapisać tak dużego pliku strumieniowo. Użyj aktualnej przeglądarki z obsługą File System Access.',
      reopening_partial: 'Ponowne otwieranie częściowo zapisanego pliku…',
      preparing_save: 'Przygotowywanie zapisu lokalnego…',
      resuming_download_progress: 'Wznawianie pobierania… {pct}% · fragment {current}/{total}',
      downloading_progress: '{mode}… {pct}% · fragment {current}/{total}',
      mode_downloading: 'Pobieranie i odszyfrowywanie',
      chunk_download_failed: 'Nie udało się pobrać fragmentu {current}.',
      decrypted_saved: 'Odszyfrowano. Plik został zapisany.',
      transfer_complete: 'Transfer zakończony',
      one_time_removed: 'Jednorazowa zaszyfrowana kopia na serwerze została usunięta.',
      decrypted_local: 'Plik został odszyfrowany wyłącznie w tej przeglądarce.',
      save_cancelled: 'Zapisywanie anulowane.',
      resume_state_cleared: '{error} Zapisany stan wznowienia został usunięty; rozpocznij pobieranie od nowa.',
      start_again: 'Rozpocznij pobieranie od nowa',
      download_paused: 'Pobieranie wstrzymane przy {pct}%. Otwórz ponownie ten link i wybierz „Wznów pobieranie”.',
      webcrypto_unsupported: 'Ta przeglądarka nie obsługuje Web Crypto API.'
    }
  };

  function normalizeLanguage(value) {
    return SUPPORTED.indexOf(value) !== -1 ? value : DEFAULT_LANGUAGE;
  }

  let language = normalizeLanguage(localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE);

  function t(key, vars) {
    let value =
      (messages[language] && messages[language][key]) ||
      messages[DEFAULT_LANGUAGE][key] ||
      key;

    if (vars) {
      Object.keys(vars).forEach(name => {
        value = value.split('{' + name + '}').join(String(vars[name]));
      });
    }

    return value;
  }

  function applyStatic() {
    document.documentElement.lang = language;

    document.querySelectorAll('[data-i18n]').forEach(node => {
      node.textContent = t(node.getAttribute('data-i18n'));
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(node => {
      node.setAttribute('aria-label', t(node.getAttribute('data-i18n-aria')));
    });

    document.querySelectorAll('[data-i18n-title]').forEach(node => {
      node.setAttribute('title', t(node.getAttribute('data-i18n-title')));
    });

    document.querySelectorAll('[data-lang]').forEach(button => {
      const active = button.getAttribute('data-lang') === language;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const page = document.body ? document.body.getAttribute('data-page') : 'home';
    const titleKey =
      page === 'download' ? 'meta_title_download' :
      page === 'terms' ? 'meta_title_terms' :
      'meta_title_home';
    document.title = t(titleKey);

    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', t('meta_description'));
  }

  function setLanguage(next) {
    language = normalizeLanguage(next);
    localStorage.setItem(STORAGE_KEY, language);
    applyStatic();
    window.dispatchEvent(new CustomEvent('sendzero:languagechange', {
      detail: { language }
    }));
  }

  function bindLanguageSwitcher() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-lang]');
      if (!button) return;
      setLanguage(button.getAttribute('data-lang'));
    });
  }

  window.SendZeroI18n = {
    t,
    setLanguage,
    getLanguage: () => language,
    applyStatic
  };

  bindLanguageSwitcher();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyStatic);
  } else {
    applyStatic();
  }
})();
