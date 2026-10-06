const { withAppDelegate } = require('expo/config-plugins')

// Expo SDK 53 / RN 0.79 no adoptan el ciclo de vida UIScene, que el SDK de iOS 27
// (Xcode 27) exige: sin un UIWindowScene asociado a la ventana, UIKit rechaza el launch.
// La ventana se sigue creando en el AppDelegate (los subscribers de Expo, como
// expo-dev-client, esperan una keyWindow al terminar didFinishLaunching) y el
// SceneDelegate la adopta asignándole el scene.
// El UIApplicationSceneManifest correspondiente vive en ios.infoPlist (app.config.ts).
// Eliminar este plugin cuando se migre a un SDK de Expo que adopte UIScene de fábrica.

const SCENE_DELEGATE = `
// El SDK de iOS 27 exige el ciclo de vida UIScene: la ventana tiene que estar
// asociada a un UIWindowScene o UIKit rechaza el lanzamiento de la app.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate
    else { return }

    // Se adopta la ventana que ya creó el AppDelegate en vez de crear una nueva,
    // para no descartar el root view controller de React Native ya montado.
    let window = appDelegate.window ?? UIWindow(windowScene: windowScene)
    window.windowScene = windowScene
    appDelegate.window = window
    self.window = window
    window.makeKeyAndVisible()

    // Deep links que abrieron la app en frío (incluye expo-dev-client).
    for context in connectionOptions.urlContexts {
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
    for activity in connectionOptions.userActivities {
      _ = appDelegate.application(UIApplication.shared, continue: activity) { _ in }
    }
  }

  // Bajo UIScene estos reemplazan a los callbacks equivalentes de UIApplicationDelegate.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(UIApplication.shared, continue: userActivity) { _ in }
  }
}
`

function withUISceneLifecycle(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('[withUISceneLifecycle] Solo soporta AppDelegate en Swift')
    }

    const contents = cfg.modResults.contents

    if (contents.includes('class SceneDelegate')) {
      return cfg
    }

    if (!contents.includes('class AppDelegate')) {
      throw new Error('[withUISceneLifecycle] No se encontró la clase AppDelegate')
    }

    // Se agrega al final del archivo para no tener que tocar el .pbxproj.
    cfg.modResults.contents = `${contents.trimEnd()}\n${SCENE_DELEGATE}`
    return cfg
  })
}

module.exports = withUISceneLifecycle
