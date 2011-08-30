/*
 * @package secureLogin
 * @author Sebastian Tschan
 * @copyright (c) Sebastian Tschan
 * @license GNU General Public License
 * @link https://blueimp.net/mozilla/
 */
var secureLoginOptions = {

	get service() {
		delete this.service;
		return this.service = secureLogin;
	},

	handleEvent: function (aEvent) {
		switch (aEvent.type) {
			case "load":
				this.onLoad();
				break;
			case "unload":
				this.onUnLoad();
				break;
		}
	},

	onLoad: function () {
		window.removeEventListener("load", this, false);
		window.addEventListener("unload", this, false);

		this.optionsInitialize();
	},

	onUnLoad: function() {
		window.removeEventListener("unload", this, false);

		this.optionsFinalize();
	},

	optionsInitialize: function () {
		// Display the shortcut combination:
		document.getElementById('keyboardShortcut').value = this.service.getFormattedShortcut();

		// Display the filenames stored in the preferences:
		try {
			let file = this.service.secureLoginPrefs.getComplexValue('loginFoundSoundFileName', Components.interfaces.nsILocalFile);
			document.getElementById('loginFoundSoundFileName').value = file.path;
		} catch (e) {
			// No file found, which is the default, so we do not log an error
		}
		try {
			let file = this.service.secureLoginPrefs.getComplexValue('loginSoundFileName', Components.interfaces.nsILocalFile);
			document.getElementById('loginSoundFileName').value = file.path;
		} catch (e) {
			// No file found, which is the default, so we do not log an error
		}
	},

	optionsFinalize: function () {
	},

	selectAudioFile: function (aDoc, aPrefName) {
		// doc is the current document from which the method has been called
		// prefName is the preference name as well as the textbox id

		try {
			// Create a file picker instance:
			let fp = Components.classes['@mozilla.org/filepicker;1']
			         .createInstance(Components.interfaces.nsIFilePicker);

			// Initialize the file picker window:
			fp.init(
				window,
				this.service.stringBundle.getString('selectAudioFile'),
				Components.interfaces.nsIFilePicker.modeOpen
			);

			// Apply a file filter for wave files:
			fp.appendFilter('*.wav','*.wav;*.WAV');
			fp.filterIndex=0;

			// Show the file picker window:
			let rv = fp.show();

			if (rv == Components.interfaces.nsIFilePicker.returnOK) {
				let file = fp.file;
				// Save the selected file in the preferences:
				this.service.secureLoginPrefs.setComplexValue(aPrefName, Components.interfaces.nsILocalFile, file);
				// Save the selected file in the associated textbox:
				aDoc.getElementById(aPrefName).value = file.path;
			}
		} catch (e) {
			this.service.log(e);
		}
	},

	applyShortcut: function (aEvent, aId) {
		// Recognize the pressed keys:
		let shortcut = this.recognizeKeys(aEvent);
		if (!shortcut) {
			return;
		}
		// Save the new shortcut:
		this.setShortcut(shortcut);
		// Update the shortcut textbox:
		let eventViewDocument = aEvent.view.document;
		if (eventViewDocument && eventViewDocument.getElementById(aId)) {
			eventViewDocument.getElementById(aId).value = this.service.getFormattedShortcut(shortcut);
		}
	},

	recognizeKeys: function (aEvent) {
		let modifiers = new Array();
		let key = '';
		let keycode = '';

		// Get the modifiers:
		if (aEvent.altKey) {
			modifiers.push('alt');
		}
		if (aEvent.ctrlKey) {
			modifiers.push('control');
		}
		if (aEvent.metaKey) {
			modifiers.push('meta');
		}
		if (aEvent.shiftKey) {
			modifiers.push('shift');
		}

		// Get the key or keycode:
		if (aEvent.charCode) {
			key = String.fromCharCode(aEvent.charCode).toUpperCase();
		} else {
			// Get the keycode from the keycodes list:
			keycode = this.getKeyCodes()[aEvent.keyCode];
			if(!keycode) {
				return null;
			}
		}

		// Shortcut may be anything, but not 'VK_TAB' alone (without modifiers),
		// as this button is used to change focus to the 'Apply' button: 
		if(modifiers.length > 0 || keycode != 'VK_TAB') {
			return this.service.shortcutFactory(modifiers, key, keycode);
		}
		return null;
	},

	setShortcut: function (aShortcut) {
		let stringData;
		if (aShortcut) {
			stringData = aShortcut.toString();
		} else {
			stringData = '';
		}
		// Save the shortcut as Unicode String in the preferences:
		this.service.secureLoginPrefs.setComplexValue(
			'shortcut',
			Components.interfaces.nsISupportsString,
			this.service.getUnicodeString(stringData)
		);
	},

	getKeyCodes: function () {
		let keycodes = new Array();
		// Get the list of keycodes from the KeyEvent object:
		for (let property in KeyEvent) {
			keycodes[KeyEvent[property]] = property.replace('DOM_','');
		}
		// VK_BACK_SPACE (index 8) must be VK_BACK:
		keycodes[8] = 'VK_BACK';
		return keycodes;
	},

	disableShortcut: function (aEvent, aId) {
		// Disable the shortcut:
		this.setShortcut(null);
		// Update the shortcut textbox:
		let eventViewDocument = aEvent.view.document;
		if (eventViewDocument && eventViewDocument.getElementById(aId)) {
			eventViewDocument.getElementById(aId).value = '';
		}
	},

};
window.addEventListener("load", secureLoginOptions, false);
