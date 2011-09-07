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

	// Event listener for the content area context menu:
	contentAreaContextMenuEventListener: null,

	get service() {
		delete this.service;
		return this.service = secureLogin;
	},

	get secureLoginButton () {
		return document.getElementById('secureLoginButton');
	},

	get contentAreaContextMenu () {
		delete this.contentAreaContextMenu;
		return this.contentAreaContextMenu = document.getElementById('contentAreaContextMenu');
	},

	get secureLoginContextMenuItem () {
		delete this.secureLoginContextMenuItem;
		return this.secureLoginContextMenuItem = document.getElementById('secureLoginContextMenuItem');
	},

	get secureLoginContextMenuMenu () {
		delete this.secureLoginContextMenuMenu;
		return this.secureLoginContextMenuMenu = document.getElementById('secureLoginContextMenuMenu');
	},

	get secureLoginContextMenuSeparator1 () {
		delete this.secureLoginContextMenuSeparator1;
		return this.secureLoginContextMenuSeparator1 = document.getElementById('secureLoginContextMenuSeparator1');
	},

	get secureLoginContextMenuSeparator2 () {
		delete this.secureLoginContextMenuSeparator2;
		return this.secureLoginContextMenuSeparator2 = document.getElementById('secureLoginContextMenuSeparator2');
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
				case 'hideContextMenuItem':
					this.hideContextMenuItemUpdate();
					break;
				case 'hideToolsMenu':
					this.hideToolsMenuUpdate();
					break;
				case 'javascriptProtection':
					this.javascriptProtectionUpdate();
					break;
			}
		}
		else if (aTopic === this.service.obsTopic) {
			switch (aData) {
				case "enableLoginButton":
					this.enableLoginButton();
					break;
				case "disableLoginButton":
					this.disableLoginButton();
					break;
				case "showAndRemoveNotification":
					let subject = aSubject.wrappedJSObject;
					this.showAndRemoveNotification(subject.label);
					break;
			}
		}
	},

	initialize: function () {
		this.service.secureLoginPrefs.addObserver('', this, false);// add this to observer.

		// Implement the event listener for the content area context menu:
		this.contentAreaContextMenuEventListener = function (event) {
			secureLoginOverlay.initContentAreaContextMenu(event);
		}

		this.initializePrefs();

		//add observer:
		Services.obs.addObserver(this, this.service.obsTopic, true);
	},

	initializePrefs: function () {
		// Set the keyboard shortcut:
		this.updateShortcut();
		this.initializeTooltip();

		// Initialize toolbar and statusbar icons and tools and context menus:
		this.hideToolsMenuUpdate();
		this.hideContextMenuItemUpdate();
		this.javascriptProtectionUpdate();
	},

	enableLoginButton: function () {
		this.secureLoginButton.removeAttribute("disabled");
	},

	disableLoginButton: function () {
		this.secureLoginButton.setAttribute("disabled", "true");
	},

	initContentAreaContextMenu: function (aEvent) {
		let cm0 = this.secureLoginContextMenuItem;
		let cm1 = this.secureLoginContextMenuMenu;
		let cm2 = this.secureLoginContextMenuSeparator1;
		let cm3 = this.secureLoginContextMenuSeparator2;
		if (cm0 && gContextMenu) {
			if (this.service.secureLoginPrefs.getBoolPref('hideContextMenuItem')
				|| gContextMenu.isContentSelected
				|| gContextMenu.onTextInput
				|| gContextMenu.onImage
				|| gContextMenu.onLink
				|| gContextMenu.onCanvas
				|| gContextMenu.onMathML
				|| !this.service.getDoc().forms
				|| !this.service.getDoc().forms.length) {
				cm0.hidden = true;
				cm1.hidden = true;
				cm2.hidden = true;
				cm3.hidden = true;
			} else {
				// Search for valid logins and outline login fields if not done automatically:
				if (!this.service.secureLoginPrefs.getBoolPref('searchLoginsOnload')) {
					this.service.searchLoginsInitialize(null, false);
				}
				if (!this.service.secureLogins || !this.service.secureLogins.length) {
					cm0.hidden = true;
					cm1.hidden = true;
					cm2.hidden = true;
					cm3.hidden = true;
				} else {
					// Determine if no master password is set or the user has already been authenticated:
					let masterPasswordRequired = true;
					if (!this.service.masterSecurityDevice.getInternalKeyToken().needsLogin()
					    || this.service.masterSecurityDevice.getInternalKeyToken().isLoggedIn()) {
						masterPasswordRequired = false;
					}
					// Show the menu or the menu item depending on the numer of logins and the MSD status:
					if (this.service.secureLogins.length > 1 && !masterPasswordRequired) {
						cm0.hidden = true;
						cm1.hidden = false;
					} else {
						cm0.hidden = false;
						cm1.hidden = true;
					}
					// Show menuseparators if not already separated:
					if (this.isPreviousNodeSeparated(cm2)) {
						cm2.hidden = true;
					} else {
						cm2.hidden = false;
					}
					if (this.isNextNodeSeparated(cm3)) {
						cm3.hidden = true;
					} else {
						cm3.hidden = false;
					}
				}
			}
		}
	},

	isNextNodeSeparated: function (aNode) {
		while (aNode) {
			aNode = aNode.nextSibling
			if (aNode.hidden) {
				continue;
			}
			if (aNode.nodeName == 'menuseparator') {
				return true;
			} else {
				return false;
			}
		}
		return true;
	},

	isPreviousNodeSeparated: function (aNode) {
		while (aNode) {
			aNode = aNode.previousSibling;
			if (aNode.hidden) {
				continue;
			}
			if (aNode.nodeName == 'menuseparator') {
				return true;
			} else {
				return false;
			}
		}
		return true;
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

	hideToolsMenuUpdate: function () {
		// Change the tools menu visibility:
		let secureLoginToolsMenu = this.secureLoginToolsMenu;
		if (secureLoginToolsMenu) {
			secureLoginToolsMenu.setAttribute(
				'hidden',
				this.service.secureLoginPrefs.getBoolPref('hideToolsMenu')
			);
		}
	},

	hideContextMenuItemUpdate: function () {
		let contentAreaContextMenu = this.contentAreaContextMenu;
		if (contentAreaContextMenu) {
			let isHideContextMenuItem = this.service.secureLoginPrefs.getBoolPref('hideContextMenuItem');
			if (!isHideContextMenuItem) {
				// Add the content area context menu listener:
				contentAreaContextMenu.addEventListener(
					'popupshowing',
					this.contentAreaContextMenuEventListener,
					false
				);
			} else {
				// Hide the SL contentare context menu entries
				// and remove the content area context menu listener:
				let cm0 = this.secureLoginContextMenuItem;
				let cm1 = this.secureLoginContextMenuMenu;
				let cm2 = this.secureLoginContextMenuSeparator1;
				let cm3 = this.secureLoginContextMenuSeparator2;
				if (cm0) {
					cm0.hidden = true;
					cm1.hidden = true;
					cm2.hidden = true;
					cm3.hidden = true;
				}
				contentAreaContextMenu.removeEventListener(
					'popupshowing',
					this.contentAreaContextMenuEventListener,
					false
				);
			}
		}
	},

	contextMenu: function (aEvent) {
		this.menuPreparation('secureLoginContextAutofillFormsMenu');
	},

	toolsMenu: function (aEvent) {
		this.menuPreparation('secureLoginToolsMenuAutofillFormsMenu');
	},

	buttonMenu: function (aEvent) {
		this.menuPreparation('secureLoginButtonMenuAutofillFormsMenu');
	},

	menuPreparation: function (aAutofillFormsMenuID) {
		let doc = this.service.getDoc();
		let autofillFormsPopupMenu = this.autofillFormsPopupMenu;
		let autofillFormsMenu = document.getElementById(aAutofillFormsMenuID);
		let autofillFormsMenuSeparator = document.getElementById(aAutofillFormsMenuID + 'Separator');
		if (this.service.secureLoginPrefs.getBoolPref('autofillFormsOnLogin') && autofillFormsPopupMenu) {
			if (autofillFormsMenu && !autofillFormsMenu.hasChildNodes()) {
				autofillFormsPopupMenu = autofillFormsPopupMenu.cloneNode(true);
				autofillFormsPopupMenu.removeAttribute('position');
				autofillFormsMenu.appendChild(autofillFormsPopupMenu);
			}
			if (autofillFormsMenu) {
				autofillFormsMenu.removeAttribute('hidden');
			}
			if (autofillFormsMenuSeparator) {
				autofillFormsMenuSeparator.removeAttribute('hidden');
			}
		} else {
			if (autofillFormsMenu) {
				autofillFormsMenu.setAttribute('hidden', 'true');
			}
			if (autofillFormsMenuSeparator) {
				autofillFormsMenuSeparator.setAttribute('hidden', 'true');
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
		this.service.secureLoginPrefs.setBoolPref(
			aPref,
			!!aEvent.target.getAttribute('checked')
		);
	},

	contextMenuSelectionLogin: function (aPopup) {
		try {
			this.service.prepareUserSelectionPopup(aPopup);
		} catch (e) {
			this.service.log(e);
			// Decrypting failed
			return false;
		}
	},

	javascriptProtectionUpdate: function () {
		this.secureLoginJavascriptProtection.setAttribute(
				'checked',
				this.service.secureLoginPrefs.getBoolPref('javascriptProtection')
		);
	},

	showAndRemoveNotification: function (aLabel, aTimeout, aId, aImage, aPriority, aButtons) {
		let pref     = this.service.secureLoginPrefs;
		let timeout  = aTimeout  ? aTimeout  : pref.getIntPref("defaultNotificationTimeout");
		let id       = aId       ? aId       : "secureLoginNotification";
		let image    = aImage    ? aImage    : pref.getCharPref("defaultNotificationImage");
		let priority = aPriority ? aPriority : "PRIORITY_INFO_HIGH";
		let buttons  = aButtons  ? aButtons  : null;
		this.showNotification(aLabel, id, image, priority, buttons);
		// Automatically remove the notification after the timeout:
		window.setTimeout(function() { secureLoginOverlay.removeNotification() }, timeout);
	},

	showNotification: function (aLabel, aId, aImage, aPriority, aButtons) {
		let service  = this.service;
		let id       = aId       ? aId       : "secureLoginNotification";
		let image    = aImage    ? aImage    : service.secureLoginPrefs.getCharPref("defaultNotificationImage");
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
		if (!document.tooltipNode
		    || !document.tooltipNode.hasAttribute('tooltip')
		    || !(document.tooltipNode.id == 'secureLoginButton')
		) {
			// Don't show any tooltip:
			aEvent.preventDefault();
			return;
		}

		// Search for valid logins and outline login fields if not done automatically:
		if (!this.service.secureLoginPrefs.getBoolPref('searchLoginsOnload')) {
			this.service.searchLoginsInitialize(null, false);
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

			if (this.service.secureLogins && this.service.secureLogins.length > 0) {

				// Hash list of unique action urls and number of logins:
				let urlsArray = new Array();

				// Go through the forms and find the unique action urls:
				for (let i = 0; i < this.service.secureLogins.length; i++) {
					let url = this.service.secureLogins[i].actionURI;
					let foundInList = false;
					// Check if the form action url is already in the list:
					for (let j = 0; j < urlsArray.length; j++) {
						if (urlsArray[j].url == url) {
							// url already in the list, increase the counter:
							foundInList = true;
							urlsArray[j].count++;
							break;
						}
					}
					if (!foundInList) {
						// Not in list, add the current url:
						urlsArray.push({ url: url, count: 1,});
					}
				}

				if (urlsArray.length) {
					// Add the url list:
					let tooltipLoginURL = document.createElement('description');
					tooltipLoginURL.setAttribute(
					  'class',
					  'secureLoginTooltipUrl'
					);
					let spacer = document.createElement("spacer");
					spacer.setAttribute("flex", "1");
					let tooltipUrlCount = document.createElement('label');
					tooltipUrlCount.setAttribute(
					  'class',
					  'secureLoginTooltipUrlCount'
					);
					for (let i = 0; i < urlsArray.length; i++) {
						let hbox = document.createElement("hbox");
						let descr = tooltipLoginURL.cloneNode(false);
						let action = urlsArray[i];
						descr.setAttribute(
						  'value',
						  action.url
						);
						let label = tooltipUrlCount.cloneNode(false);
						label.setAttribute(
						  'value',
						  '('+ action.count +')'
						);

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
			  '('+this.service.getFormattedShortcut()+')'
			);
		}
	},

	finalize: function () {
		// Remove the content area context menu listener:
		let contentAreaContextMenu = this.contentAreaContextMenu;
		if(contentAreaContextMenu) {
			contentAreaContextMenu.removeEventListener(
				'popupshowing',
				this.contentAreaContextMenuEventListener,
				false
			);
		}

		// Remove the preferences Observer:
		this.service.secureLoginPrefs.removeObserver('', this);
		// remove observer:
		Services.obs.removeObserver(this, this.service.obsTopic);
	},

};
window.addEventListener("load", secureLoginOverlay, false);
