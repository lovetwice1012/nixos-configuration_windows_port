import QtQuick
import QtQuick.Window
import QtQuick.Controls
import Quickshell
import Quickshell.Io

FloatingWindow {
    id: masterWindow
    title: "qs-master"
    color: "transparent"
    
    // Always mapped to prevent Wayland from destroying the surface and Hyprland from auto-centering!
    visible: true 

    property int screenW: 1920
    property int screenH: 1080

    property string currentActive: "hidden" 
    property bool isVisible: false
    property string activeArg: ""
    property bool disableMorph: false 
    property bool isWallpaperTransition: false 

    // Track the last position to anchor the 1x1 parking dot
    property int currentX: -5000
    property int currentY: -5000

    property real animW: 10
    property real animH: 10

    property var layouts: {
        "battery":   { w: 480, h: 760, x: screenW - 500, y: 70, comp: "battery/BatteryPopup.qml" },
        "calendar":  { w: 1450, h: 750, x: 235, y: 70, comp: "calendar/CalendarPopup.qml" },
        "music":     { w: 700, h: 620, x: 12, y: 70, comp: "music/MusicPopup.qml" },
        "network":   { w: 900, h: 700, x: screenW - 920, y: 70, comp: "network/NetworkPopup.qml" },
        "stewart":   { w: 800, h: 600, x: (screenW/2)-(800/2), y: (screenH/2)-(600/2), comp: "stewart/stewart.qml" },
        "wallpaper": { w: 1920, h: 500, x: 0, y: (screenH/2)-(500/2), comp: "wallpaper/WallpaperPicker.qml" },
        "hidden":    { w: 1, h: 1, x: -5000, y: -5000, comp: "" } 
    }

    width: 1
    height: 1
    implicitWidth: width
    implicitHeight: height

    onIsVisibleChanged: {
        if (isVisible) masterWindow.requestActivate();
    }

    Item {
        anchors.centerIn: parent
        width: masterWindow.animW
        height: masterWindow.animH
        clip: true 

        Behavior on width { enabled: !masterWindow.disableMorph; NumberAnimation { duration: 350; easing.type: Easing.InOutCubic } }
        Behavior on height { enabled: !masterWindow.disableMorph; NumberAnimation { duration: 350; easing.type: Easing.InOutCubic } }

        opacity: masterWindow.isVisible ? 1.0 : 0.0
        Behavior on opacity { NumberAnimation { duration: masterWindow.isWallpaperTransition ? 150 : 300; easing.type: Easing.InOutSine } }

        StackView {
            id: widgetStack
            anchors.fill: parent
            focus: true
            
            onCurrentItemChanged: {
                if (currentItem) currentItem.forceActiveFocus();
            }

            replaceEnter: Transition {
                ParallelAnimation {
                    NumberAnimation { property: "opacity"; from: 0.0; to: 1.0; duration: 450; easing.type: Easing.OutCubic }
                    NumberAnimation { property: "scale"; from: 0.95; to: 1.0; duration: 450; easing.type: Easing.OutBack }
                }
            }
            replaceExit: Transition {
                ParallelAnimation {
                    NumberAnimation { property: "opacity"; from: 1.0; to: 0.0; duration: 350; easing.type: Easing.InCubic }
                    NumberAnimation { property: "scale"; from: 1.0; to: 1.05; duration: 350; easing.type: Easing.InCubic }
                }
            }
        }
    }

    Shortcut {
        sequence: "Escape"
        onActivated: Quickshell.execDetached(["bash", Quickshell.env("HOME") + "/.config/hypr/scripts/quickshell/qs_manager.sh", "close"])
    }

    function switchWidget(newWidget, arg) {
        let involvesWallpaper = (newWidget === "wallpaper" || currentActive === "wallpaper");
        masterWindow.isWallpaperTransition = involvesWallpaper;

        if (newWidget === "hidden") {
            if (currentActive !== "hidden" && layouts[currentActive]) {
                if (currentActive === "wallpaper") {
                    masterWindow.disableMorph = true; 
                    masterWindow.isVisible = false; 
                    delayedClear.start(); 
                } else {
                    masterWindow.disableMorph = false;
                    let t = layouts[currentActive];
                    let cx = t.x + (t.w/2);
                    let cy = t.y + (t.h/2);
                    
                    masterWindow.animW = 10;
                    masterWindow.animH = 10;
                    masterWindow.isVisible = false;
                    
                    Quickshell.execDetached(["bash", "-c", `hyprctl dispatch resizewindowpixel "exact 10 10,title:^(qs-master)$" && hyprctl dispatch movewindowpixel "exact ${cx} ${cy},title:^(qs-master)$"`]);
                    delayedClear.start();
                }
            }
        } else {
            if (currentActive === "hidden") {
                if (newWidget === "wallpaper") {
                    masterWindow.disableMorph = true;
                    let t = layouts[newWidget];
                    
                    masterWindow.animW = t.w;
                    masterWindow.animH = t.h;
                    masterWindow.width = t.w;
                    masterWindow.height = t.h;
                    masterWindow.currentX = t.x;
                    masterWindow.currentY = t.y;
                    masterWindow.currentActive = newWidget;
                    masterWindow.activeArg = arg;

                    Quickshell.execDetached(["bash", "-c", `hyprctl dispatch resizewindowpixel "exact ${t.w} ${t.h},title:^(qs-master)$" && hyprctl dispatch movewindowpixel "exact ${t.x} ${t.y},title:^(qs-master)$"`]);
                    
                    // Injecting the argument strictly at component creation so it initializes on the target frame
                    let props = { "widgetArg": arg };
                    widgetStack.replace(t.comp, props, StackView.Immediate);
                    
                    teleportFadeInTimer.newWidget = newWidget;
                    teleportFadeInTimer.newArg = arg;
                    teleportFadeInTimer.start();
                } else {
                    masterWindow.disableMorph = false;
                    let t = layouts[newWidget];
                    let cx = t.x + (t.w / 2);
                    let cy = t.y + (t.h / 2);
                    
                    masterWindow.animW = 10;
                    masterWindow.animH = 10;
                    masterWindow.width = 10;
                    masterWindow.height = 10;
                    
                    Quickshell.execDetached(["bash", "-c", `hyprctl dispatch movewindowpixel "exact ${cx} ${cy},title:^(qs-master)$"`]);
                    
                    prepTimer.newWidget = newWidget;
                    prepTimer.newArg = arg;
                    prepTimer.start(); 
                }
            } else {
                if (involvesWallpaper) {
                    masterWindow.disableMorph = true;
                    masterWindow.isVisible = false; 
                    teleportFadeOutTimer.newWidget = newWidget;
                    teleportFadeOutTimer.newArg = arg;
                    teleportFadeOutTimer.start();
                } else {
                    masterWindow.disableMorph = false;
                    executeSwitch(newWidget, arg, false);
                }
            }
        }
    }

    Timer {
        id: prepTimer
        interval: 50
        property string newWidget: ""
        property string newArg: ""
        onTriggered: executeSwitch(newWidget, newArg, false)
    }

    Timer {
        id: teleportFadeOutTimer
        interval: 150 
        property string newWidget: ""
        property string newArg: ""
        onTriggered: {
            let t = layouts[newWidget];

            masterWindow.currentActive = newWidget;
            masterWindow.activeArg = newArg;

            masterWindow.animW = t.w;
            masterWindow.animH = t.h;
            masterWindow.width = t.w;
            masterWindow.height = t.h;
            masterWindow.currentX = t.x;
            masterWindow.currentY = t.y;

            Quickshell.execDetached(["bash", "-c", `hyprctl dispatch resizewindowpixel "exact ${t.w} ${t.h},title:^(qs-master)$" && hyprctl dispatch movewindowpixel "exact ${t.x} ${t.y},title:^(qs-master)$"`]);

            // Injecting the argument strictly at component creation
            let props = newWidget === "wallpaper" ? { "widgetArg": newArg } : {};
            widgetStack.replace(t.comp, props, StackView.Immediate);

            teleportFadeInTimer.newWidget = newWidget;
            teleportFadeInTimer.newArg = newArg;
            teleportFadeInTimer.start();
        }
    }

    Timer {
        id: teleportFadeInTimer
        interval: 50 
        property string newWidget: ""
        property string newArg: ""
        onTriggered: {
            masterWindow.isVisible = true; 
            if (newWidget !== "wallpaper") resetMorphTimer.start();
        }
    }

    Timer {
        id: resetMorphTimer
        interval: 350
        onTriggered: masterWindow.disableMorph = false
    }

    function executeSwitch(newWidget, arg, immediate) {
        masterWindow.currentActive = newWidget;
        masterWindow.activeArg = arg;
        
        let t = layouts[newWidget];
        masterWindow.animW = t.w;
        masterWindow.animH = t.h;
        masterWindow.width = t.w;
        masterWindow.height = t.h;
        masterWindow.currentX = t.x;
        masterWindow.currentY = t.y;
        
        Quickshell.execDetached(["bash", "-c", `hyprctl dispatch resizewindowpixel "exact ${t.w} ${t.h},title:^(qs-master)$" && hyprctl dispatch movewindowpixel "exact ${t.x} ${t.y},title:^(qs-master)$"`]);
        
        masterWindow.isVisible = true;
        
        let props = newWidget === "wallpaper" ? { "widgetArg": arg } : {};

        if (immediate) {
            widgetStack.replace(t.comp, props, StackView.Immediate);
        } else {
            widgetStack.replace(t.comp, props);
        }
    }

    Timer {
        interval: 50; running: true; repeat: true
        onTriggered: { if (!ipcPoller.running) ipcPoller.running = true; }
    }

    Process {
        id: ipcPoller
        command: ["bash", "-c", "if [ -f /tmp/qs_widget_state ]; then cat /tmp/qs_widget_state; rm /tmp/qs_widget_state; fi"]
        stdout: StdioCollector {
            onStreamFinished: {
                let rawCmd = this.text.trim();
                if (rawCmd === "") return;

                let parts = rawCmd.split(":");
                let cmd = parts[0];
                let arg = parts.length > 1 ? parts[1] : "";

                if (cmd === "close") {
                    switchWidget("hidden", "");
                } else if (layouts[cmd]) {
                    delayedClear.stop();
                    if (masterWindow.isVisible && masterWindow.currentActive === cmd) {
                        switchWidget("hidden", "");
                    } else {
                        switchWidget(cmd, arg);
                    }
                }
            }
        }
    }

    Timer {
        id: delayedClear
        interval: masterWindow.isWallpaperTransition ? 150 : 350
        onTriggered: {
            masterWindow.currentActive = "hidden";
            widgetStack.clear();
            masterWindow.disableMorph = false;
            
            // Move window completely off-screen using the hidden layout coordinates!
            let cmd = `hyprctl dispatch resizewindowpixel "exact 1 1,title:^(qs-master)$" && hyprctl dispatch movewindowpixel "exact -5000 -5000,title:^(qs-master)$"`;
            Quickshell.execDetached(["bash", "-c", cmd]);
        }
    }
}
