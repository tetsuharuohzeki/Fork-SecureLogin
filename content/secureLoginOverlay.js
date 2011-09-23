/*
 * @package secureLogin
 * @author Sebastian Tschan
 * @copyright (c) Sebastian Tschan
 * @license GNU General Public License
 * @link https://blueimp.net/mozilla/
 */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
var secureLoginOverlay = {

	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
	                                       Components.interfaces.nsISupportsWeakReference]),

	get service() {
		delete this.service;
		return this.service = secureLogin;
	},

	get secureLoginButton () {
		return document.getElementById('secureLoginButton');
	},

	get mainKeyset () {
		delete this.mainKeyset;
		return this.mainKeyset = document.getElementById('mainKeyset');
	},

	get secureLoginTooltip () {
		delete this.secureLoginTooltip;
		return this.secureLoginTooltip = document.getElementById('secureLoginTooltip');
	},

	get autofillFormsPopupMenu () {
		delete this.autofillFormsPopupMenu;
		return this.autofillFormsPopupMenu = document.getElementById('autofillFormsPopupMenu');
	},

	get secureLoginShortCut () {
		delete this.secureLoginShortCut;
		return this.secureLoginShortCut = document.getElementById('secureLoginShortCut');
	},

	get secureLoginToolsMenu () {
		delete this.secureLoginToolsMenu;
		return this.secureLoginToolsMenu =  document.getElementById('secureLoginToolsMenu')
	},

	get secureLoginJavascriptProtection () {
		delete this.secureLoginJavascriptProtection;
		return this.secureLoginJavascriptProtection = document.getElementById('secureLoginJavascriptProtection');
	},

	get tooltipNoLoginLabel () {
		delete this.tooltipNoLoginLabel;
		return this.tooltipNoLoginLabel = document.getElementById("secureLoginTooltips:noLogin");
	},

	get tooltipNoLoginBox () {
		delete this.tooltipNoLoginBox;
		return this.tooltipNoLoginBox = document.getElementById("secureLoginTooltipBox:noLogin");
	},

	get tooltipExistLoginBox () {
		delete this.tooltipExistLoginBox;
		return this.tooltipExistLoginBox = document.getElementById("secureLoginTooltipBox:existLogin");
	},

	get tooltipLoginUrlsList () {
		delete this.tooltipLoginUrlsList;
		return this.tooltipLoginUrlsList = document.getElementById("secureLoginTooltipUrlsList")
	},

	get tooltipTitleLabel () {
		delete this.tooltipTitleLabel;
		return this.tooltipTitleLabel = document.getElementById("secureLoginTooltipTitleLabel");
	},

	get tooltipKeyboardShortcut () {
		delete this.tooltipKeyboardShortcut;
		return this.tooltipKeyboardShortcut = document.getElementById("secureLoginTooltipKeyboardShortcut");
	},

	get tooltipUrlHeaderURL () {
		delete this.tooltipUrlHeaderURL;
		return this.tooltipUrlHeaderURL = document.getElementById("secureLoginTooltipUrlHeader:URL");
	},

	get tooltipUrlHeaderCount () {
		delete this.tooltipUrlHeaderCount;
		return this.tooltipUrlHeaderCount = document.getElementById("secureLoginTooltipUrlHeader:count");
	},

	get loginUserSelectionPopup () {
		delete this.loginUserSelectionPopup;
		return this.loginUserSelectionPopup = document.getElementById('secureLoginUserSelectionPopup');
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

		this.initialize();
		this.service.initialize();
	},

	onUnLoad: function() {
		window.removeEventListener("unload", this, false);

		this.service.finalize();
		this.finalize();
	},

	observe: function (aSubject, aTopic, aData) {
		// Only observe preferences changes:
		if (aTopic === 'nsPref:changed') {
			switch (aData) {
				case 'shortcut':
					this.updateShortcut();
					this.initializeTooltip();
					break;
				case 'showToolsMenu':
					this.showToolsMenuUpdate();
					break;
				case 'javascriptProtection':
					this.javascriptProtectionUpdate();
					break;
			}
		}
		else if (aTopic === this.service.obsTopic) {
			switch (aData) {
				case "showDoorhangerLogin":
					if (aSubject.wrappedJSObject === window) {
						this.showDoorhangerLogin();
					}
					break;
				case "enableLoginButton":
					if (aSubject.wrappedJSObject === window) {
						this.enableLoginButton();
					}
					break;
				case "disableLoginButton":
					if (aSubject.wrappedJSObject === window) {
						this.disableLoginButton();
					}
					break;
				case "showAndRemoveNotification":
					let subject = aSubject.wrappedJSObject;
					this.showAndRemoveNotification(subject.label);
					break;
			}
		}
	},

	initialize: function () {
		this.service.prefs.addObserver('', this, false);// add this to observer.

		this.initializePrefs();

		//add observer:
		Services.obs.addObserver(this, this.service.obsTopic, true);
	},

	initializePrefs: function () {
		// Set the keyboard shortcut:
		this.updateShortcut();
		this.initializeTooltip();

		// Initialize toolbar and statusbar icons and tools and context menus:
		this.showToolsMenuUpdate();
		this.javascriptProtectionUpdate();
	},

	showDoorhangerLogin: function () {
		let service = this.service;
		let GetStringFromName = service.stringBundle.GetStringFromName;

		let description = GetStringFromName("doorhangerDescription");
		let dismissed   = service.showDoorhangerDismissed;

		let mainAction = {
			label    : GetStringFromName("doorhangerLoginLabel"),
			accessKey: GetStringFromName("doorhangerLoginAccessKey"),
			callback : function () {
				secureLogin.login();
			},
		};

		PopupNotifications.show(
			gBrowser.selectedBrowser,
			"securelogin-foundlogin",
			description,
			"password-notification-icon",
			mainAction,
			null,
			{
				persistence        : 0,
				timeout            : null,
				persistWhileVisible: false,
				dismissed          : dismissed,
				eventCallback      : null,
				neverShow          : false,
			 }
		);
	},

	enableLoginButton: function () {
		let loginButton = this.secureLoginButton;
		if (loginButton) {
			loginButton.removeAttribute("disabled");
		}
	},

	disableLoginButton: function () {
		let loginButton = this.secureLoginButton;
		if (loginButton) {
			loginButton.setAttribute("disabled", "true");
		}
	},

	updateShortcut: function () {
		// Setting the shortcut object to "null" will update it on the next getShortcut() call:
		this.service.shortcut = null;
		// Get the keyboard shortcut elements:
		let modifiers = this.service.getShortcut()['modifiers'].join(' ');
		let key = this.service.getShortcut()['key'];
		let keycode = this.service.getShortcut()['keycode'];

		// Remove current key if existing:
		let secureLoginShortCut = this.secureLoginShortCut;
		if (secureLoginShortCut) {
			this.mainKeyset.removeChild(secureLoginShortCut);
		}

		// Check if keyboard shortcut is enabled (either key or keycode set):
		if (key || keycode) {
			// Create a key element:
			let keyNode = document.createElement('key');

			keyNode.setAttribute('id', 'secureLoginShortCut');
			keyNode.setAttribute('command', 'secureLogin');

			// Set the key attributes from saved shortcut:
			keyNode.setAttribute('modifiers', modifiers);
			if (key) {
				keyNode.setAttribute('key', key);
			} else {
				keyNode.setAttribute('keycode', keycode);
			}

			// Add the key to the mainKeyset:
			this.mainKeyset.appendChild(keyNode);
		}
	},

	showToolsMenuUpdate: function () {
		// Change the tools menu visibility:
		let secureLoginToolsMenu = this.secureLoginToolsMenu;
		if (secureLoginToolsMenu) {
			let prefValue = this.service.prefs.getBoolPref("showToolsMenu");
			if (prefValue) {
				secureLoginToolsMenu.removeAttribute("hidden");
			}
			else {
				secureLoginToolsMenu.setAttribute("hidden", "true");
			}
		}
	},

	clickHandler: function (aEvent) {
		switch (aEvent.button) {
			case 1:
				this.service.masterSecurityDeviceLogout(aEvent);
				break;
		}
	},

	changePref: function (aEvent, aPref) {
		// Attribute 'checked' is empty or true, setting must be false or true:
		this.service.prefs.setBoolPref(
			aPref,
			!!aEvent.target.getAttribute('checked')
		);
	},

	javascriptProtectionUpdate: function () {
		this.secureLoginJavascriptProtection.setAttribute(
				'checked',
				this.service.prefs.getBoolPref('javascriptProtection')
		);
	},

	showAndRemoveNotification: function (aLabel, aTimeout, aId, aImage, aPriority, aButtons) {
		let timeout  = aTimeout  ? aTimeout  : this.service.prefs.getIntPref("defaultNotificationTimeout");
		this.showNotification(aLabel, aId, aImage, aPriority, aButtons);
		// Automatically remove the notification after the timeout:
		window.setTimeout(function() { secureLoginOverlay.removeNotification() }, timeout);
	},

	showNotification: function (aLabel, aId, aImage, aPriority, aButtons) {
		let service  = this.service;
		let id       = aId       ? aId       : "secureLoginNotification";
		let image    = aImage    ? aImage    : service.prefs.getCharPref("defaultNotificationImage");
		let priority = aPriority ? aPriority : "PRIORITY_INFO_HIGH";
		let buttons  = aButtons  ? aButtons  : null;
		// First remove notifications with the same id:
		this.removeNotification(id);
		let notificationBox = service.getBrowser().getNotificationBox();
		if (notificationBox) {
			notificationBox.appendNotification(
			  aLabel,
			  id,
			  image,
			  priority,
			  buttons
			);
		}
	},

	removeNotification: function (aId) {
		let id = aId ? aId : "secureLoginNotification";
		let notificationBox = this.service.getBrowser().getNotificationBox();
		if (notificationBox) {
			let notification = notificationBox.getNotificationWithValue(id);
			if (notification) {
				notificationBox.removeNotification(notification);
			}
		}
	},

	tooltip: function (aEvent) {
		// Check if document.tooltipNode exists and if it is shown above a valid node:
		let tooltipNode = document.tooltipNode;
		if (!tooltipNode || !tooltipNode.hasAttribute('tooltip') ||
		    !(tooltipNode.getAttribute("id") === "secureLoginButton") ) {
			// Don't show any tooltip:
			aEvent.preventDefault();
			return;
		}

		let service = this.service;
		// Search for valid logins and outline login fields if not done automatically:
		if (!service.searchLoginsOnload) {
			service.searchLoginsInitialize(null, false);
		}

		// hidden both boxes in tooltip:
		this.tooltipExistLoginBox.hidden = true;
		this.tooltipNoLoginBox.hidden = true;

		// Get the tooltip node:
		let isLoginExist = false;
		let tooltip = this.tooltipLoginUrlsList;
		if (tooltip) {
			// Remove all children nodes:
			while (tooltip.hasChildNodes()) {
				tooltip.removeChild(tooltip.firstChild);
			}

			let secureLogins = service.secureLogins;
			if (secureLogins && secureLogins.length > 0) {

				// Hash list of unique action urls and number of logins:
				let urlsArray = [];

				// Go through the forms and find the unique action urls:
				for (let i = 0, l = secureLogins.length; i < l; i++) {
					let url = secureLogins[i].actionURI;
					// Check if the form action url is already in the list:
					let foundInList = urlsArray.some(function(aElm){
						if (aElm.url === url) {
							aElm.count++;
							return true
						}
					});
					if (!foundInList) {
						// Not in list, add the current url:
						urlsArray.push({ url: url, count: 1,});
					}
				}

				if (urlsArray.length) {
					// Add the url list:
					let tooltipLoginURL = document.createElement('description');
					tooltipLoginURL.setAttribute("class", "secureLoginTooltipUrl");

					let spacer = document.createElement("spacer");
					spacer.setAttribute("flex", "1");

					let tooltipUrlCount = document.createElement('label');
					tooltipUrlCount.setAttribute("class", "secureLoginTooltipUrlCount");

					for (let i = 0, l = urlsArray.length; i < l; i++) {
						let action = urlsArray[i];

						let descr = tooltipLoginURL.cloneNode(false);
						descr.setAttribute("value", action.url);

						let label = tooltipUrlCount.cloneNode(false);
						label.setAttribute("value", "("+ action.count +")");

						let hbox = document.createElement("hbox");
						hbox.appendChild(descr);
						hbox.appendChild(spacer.cloneNode(false));
						hbox.appendChild(label);
						tooltip.appendChild(hbox);
					}

					isLoginExist = true;
				}
			}
		}
		this.tooltipExistLoginBox.hidden = !isLoginExist;
		this.tooltipNoLoginBox.hidden = isLoginExist;
	},

	initializeTooltip: function () {
		// Add the login label plus shortcut, if not empty:
		let formattedShortcut = this.service.getFormattedShortcut();
		if (formattedShortcut) {
			this.tooltipKeyboardShortcut.setAttribute(
			  'value',
			  '('+ formattedShortcut +')'
			);
		}
	},

	userSelectionLogin: function (aEvent) {
		let service = this.service;
		if (aEvent.ctrlKey) {
			service.masterSecurityDeviceLogout();
			return;
		}

		// Search for valid logins and outline login fields if not done automatically:
		if (!service.searchLoginsOnload) {
			service.searchLoginsInitialize(null, false);
		}

		// Check for valid logins:
		let secureLogins = service.secureLogins;
		if (secureLogins && secureLogins.length > 0) {
			if (secureLogins.length > 1) {
				// Determine if no master password is set or the user has already been authenticated:
				let masterPasswordRequired = true;
				let token = service.masterSecurityDevice.getInternalKeyToken();
				if (!token.needsLogin() || token.isLoggedIn()) {
					masterPasswordRequired = false;
				}
				let popup = service.loginUserSelectionPopup;
				if (popup && (typeof popup.openPopup == "function") && !masterPasswordRequired) {
					try {
						this.prepareUserSelectionPopup(popup);
						// Show the popup menu (only available for Firefox >= 3):
						popup.openPopup(aEvent.target, null, 0, 0, false, true);
					}
					catch (e) {
						Components.utils.reportError(e);
						// Decrypting failed
						return;
					}
				}
				else {
					// Show a selection box instead of the popup menu:
					service.login(null, null, true);
				}
			}
			else {
				// Just login with the single available username:
				service.login(null, 0, true);
			}
		}
	},

	prepareUserSelectionPopup: function (aPopup) {
		let service = this.service;

		// Remove the old child nodes (should be already removed by the popuphiding event):
		while (aPopup.hasChildNodes()) {
			aPopup.removeChild(aPopup.firstChild);
		}

		let secureLogins = service.secureLogins;
		if (secureLogins) {
			let menuitem = document.createElement("menuitem");
			menuitem.setAttribute("class", "menuitem-iconic secureLoginUserIcon");
			// Add a menuitem for each available user login:
			for (let i = 0, l = secureLogins.length; i < l; i++) {
				let username = service.getUsernameFromLoginObject(secureLogins[i].loginObject);
				// Show form index?
				if (service.showFormIndex) {
					username += "  (" + secureLogins[i].formIndex + ")";
				}
				menuitem = menuitem.cloneNode(false);
				menuitem.setAttribute("label", username);
				menuitem.setAttribute("oncommand", "secureLogin.login(null, " + i + ", true);");
				aPopup.appendChild(menuitem);
			}
		}
	},

	finalize: function () {
		// Remove the preferences Observer:
		this.service.prefs.removeObserver('', this);
		// remove observer:
		Services.obs.removeObserver(this, this.service.obsTopic);
	},

};
window.addEventListener("load", secureLoginOverlay, false);
