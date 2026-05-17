; Customizacion NSIS para Dreitz Keys Installer.
; Mismo estilo dark/branded que el installer del launcher.

!define removeDefaultUninstallWelcomePage

!macro customHeader
  RequestExecutionLevel user
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Bienvenido a la instalacion de Dreitz Keys"
  !define MUI_WELCOMEPAGE_TEXT "Dreitz Keys es tu boveda personal de licencias de juegos.$\r$\n$\r$\nOrganiza tus claves de Steam, GOG, Epic y otras tiendas; todo cifrado localmente, sin nube obligatoria.$\r$\n$\r$\nHaz clic en Siguiente para continuar."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "Dreitz Keys instalado correctamente"
  !define MUI_FINISHPAGE_TEXT "Dreitz Keys esta listo. Abre la app e inicia sesion para empezar a registrar tus licencias."
  !define MUI_FINISHPAGE_RUN "$INSTDIR\Dreitz Keys.exe"
  !define MUI_FINISHPAGE_RUN_TEXT "Abrir Dreitz Keys ahora"
  !insertmacro MUI_PAGE_FINISH
!macroend

!macro customInstall
  nsProcess::_FindProcess "Dreitz Keys.exe"
  Pop $R0
  ${If} $R0 = 0
    nsProcess::_KillProcess "Dreitz Keys.exe"
    Sleep 1500
  ${EndIf}

  ${If} ${FileExists} "$INSTDIR\resources\icon.ico"
    ${If} ${FileExists} "$newStartMenuLink"
      CreateShortCut "$newStartMenuLink" "$appExe" "" "$INSTDIR\resources\icon.ico" 0 "" "" "${APP_DESCRIPTION}"
      WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
    ${EndIf}
    ${If} ${FileExists} "$newDesktopLink"
      CreateShortCut "$newDesktopLink" "$appExe" "" "$INSTDIR\resources\icon.ico" 0 "" "" "${APP_DESCRIPTION}"
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${EndIf}
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  ${EndIf}
!macroend

!macro customUnInstall
  nsProcess::_FindProcess "Dreitz Keys.exe"
  Pop $R0
  ${If} $R0 = 0
    nsProcess::_KillProcess "Dreitz Keys.exe"
    Sleep 1500
  ${EndIf}
!macroend
