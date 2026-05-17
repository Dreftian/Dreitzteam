; Customizacion NSIS para Dreitz Installer.
; electron-builder lo incluye via electron-builder.yml -> nsis.include

!define removeDefaultUninstallWelcomePage

!macro customHeader
  RequestExecutionLevel user
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Bienvenido a la instalacion de Dreitz"
  !define MUI_WELCOMEPAGE_TEXT "Dreitz es tu nueva forma de descubrir, comprar y jugar.$\r$\n$\r$\nCatalogo curado de 100 titulos AAA, precios reales y biblioteca personal.$\r$\n$\r$\nHaz clic en Siguiente para continuar."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "Dreitz instalado correctamente"
  !define MUI_FINISHPAGE_TEXT "Dreitz esta listo para usar. Abre la app e inicia sesion para empezar a explorar el catalogo."
  !define MUI_FINISHPAGE_RUN "$INSTDIR\Dreitz.exe"
  !define MUI_FINISHPAGE_RUN_TEXT "Abrir Dreitz ahora"
  !insertmacro MUI_PAGE_FINISH
!macroend

!macro customInstall
  nsProcess::_FindProcess "Dreitz.exe"
  Pop $R0
  ${If} $R0 = 0
    nsProcess::_KillProcess "Dreitz.exe"
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
  nsProcess::_FindProcess "Dreitz.exe"
  Pop $R0
  ${If} $R0 = 0
    nsProcess::_KillProcess "Dreitz.exe"
    Sleep 1500
  ${EndIf}
!macroend
