# 05 — Captura y persistencia de fotos

Las fotos se copian a `documentDirectory/kma/photos/<submissionId>/` apenas se toman, porque `Library/Caches` puede
ser purgada por iOS con poco espacio. No requiere red.

## 5.1 Tomar o elegir una foto

```mermaid
sequenceDiagram
  actor A as Auditor
  participant PF as PhotoField / DynamicForm
  participant PC as pickOrCapturePhoto
  participant IP as expo-image-picker
  participant PP as persistPhoto
  participant EW as ensureWebImage
  participant IM as ImageManipulator
  participant FS as File system

  A->>PF: "Add photo"
  PF->>PC: capturePhoto() → pickOrCapturePhoto(submissionId)
  PC-->>A: ActionSheet: Camera / Photo Library / Cancel
  alt Camera
    PC->>IP: requestCameraPermissionsAsync
    alt permiso denegado
      PC-->>A: alerta "Camera permission denied"
    else concedido
      PC->>IP: launchCameraAsync(quality 0.8)
    end
  else Photo Library
    PC->>IP: requestMediaLibraryPermissionsAsync
    PC->>IP: launchImageLibraryAsync(quality 0.8)
  end
  IP-->>PC: uri temporal (caché) o cancelado
  PC->>PP: persistPhoto(uri, submissionId)
  PP->>EW: ensureWebImage(uri)
  alt .heic / .heif
    EW->>IM: manipulate → JPEG (0.9)
    IM-->>EW: uri JPEG
  else JPEG / PNG
    EW-->>PP: misma uri (sin recomprimir)
  end
  PP->>FS: makeDirectory + copyAsync → kma/photos/<submissionId>/<photoId>.<ext>
  PP->>FS: borra la copia convertida de caché (si hubo conversión)
  PP-->>PC: uri persistida
  PC-->>PF: uri
  PF->>PF: agrega la uri al valor del campo
```

## 5.2 Quitar una foto

```mermaid
sequenceDiagram
  actor A as Auditor
  participant PF as PhotoField / DynamicForm
  participant PH as discardPhoto
  participant FS as File system

  A->>PF: "Remove"
  PF->>PF: quita la uri del array del campo
  PF->>PH: discardPhoto(uri)
  PH->>FS: deleteAsync (solo si está bajo kma/photos)
```

## 5.3 Fotos guardadas en caché por versiones anteriores (migración en el arranque)

```mermaid
sequenceDiagram
  participant B as bootstrapApp
  participant M as migrateCachedPhotos
  participant SR as sqliteSubmissionRepo
  participant FS as File system
  participant OB as sqliteOutboxRepo

  B->>M: migrateCachedPhotos()
  M->>SR: listPendingWithFiles('draft' y 'queued')
  loop cada submission con fotos
    loop cada foto file:// fuera de kma/photos
      M->>FS: getInfoAsync(uri)
      alt existe
        M->>FS: copyAsync → kma/photos/<submissionId>/
        M->>M: reescribe la uri en el payload
      else ya no existe
        M->>M: cuenta la foto faltante
      end
    end
    M->>SR: saveDraft(payload reescrito)
    opt hubo fotos faltantes y estaba 'queued'
      M->>SR: markStatus('failed', photo_missing)
      M->>OB: markFailedBySubmissionId('photo_missing')
    end
  end
```

La migración es idempotente: las URIs ya persistidas se saltean.
