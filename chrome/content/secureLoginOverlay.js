/*
 * @package secureLogin
 * @author Sebastian Tschan
 * @copyright (c) Sebastian Tschan
 * @license GNU General Public License
 * @link https://blueimp.net/mozilla/
 */
var secureLoginOverlay = {

	// Event listener for the content area context menu:
	contentAreaContextMenuEventListener: null,

	get service() {
		delete this.service;
		return this.service = secureLogin;
	},

	get secureLoginButton () {
		delete this.secureLoginButton;
		return this.secureLoginButton = document.getElementById('secureLoginButton');
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

	get secureLoginPanelIcon () {
		delete this.secureLoginPanelIcon;
		return this.secureLoginPanelIcon = document.getElementById('secureLoginPanelIcon');
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

		this.service.initialize();
		this.initialize();
	},

	onUnLoad: function() {
		window.removeEventListener("unload", this, false);

		this.finalize();
		this.service.finalize();
	},

	observe: function (aSubject, aTopic, aData) {
		// Only observe preferences changes:
		if (aTopic != 'nsPref:changed') {
			return;
		}
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
			case 'hideStatusbarIcon':
				this.hideStatusbarIconUpdate();
				break;
			case 'hideToolbarButton':
				this.hideToolbarButtonUpdate();
				this.hideToolbarButtonMenuUpdate();
				break;
			case 'hideToolbarButtonMenu':
				this.hideToolbarButtonMenuUpdate();
				break;
			case 'javascriptProtection':
				this.javascriptProtectionUpdate();
				break;
		}
	},

	initialize: function () {
		this.service.secureLoginPrefs.addObserver('', this, false);// add this to observer.

		// Implement the event listener for the content area context menu:
		this.contentAreaContextMenuEventListener = function (event) {
			secureLoginOverlay.initContentAreaContextMenu(event);
		}

		this.initializePrefs();
	},

	initializePrefs: function () {
		// Set the keyboard shortcut:
		this.updateShortcut();
		this.initializeTooltip();

		// Initialize toolbar and statusbar icons and tools and context menus:
		this.hideToolbarButtonUpdate();
		this.hideToolbarButtonMenuUpdate();
		this.hideStatusbarIconUpdate();
		this.hideToolsMenuUpdate();
		this.hideContextMenuItemUpdate();
		this.javascriptProtectionUpdate();
	},

	initContentAreaContextMenu: function (aEvent) {
		var cm0 = this.secureLoginContextMenuItem;
		var cm1 = this.secureLoginContextMenuMenu;
		var cm2 = this.secureLoginContextMenuSeparator1;
		var cm3 = this.secureLoginContextMenuSeparator2;
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
					this.service.searchLoginsInitialize();
				}
				if (!this.service.secureLogins || !this.service.secureLogins.length) {
					cm0.hidden = true;
					cm1.hidden = true;
					cm2.hidden = true;
					cm3.hidden = true;
				} else {
					// Determine if no master password is set or the user has already been authenticated:
					var masterPasswordRequired = true;
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
		var modifiers = this.service.getShortcut()['modifiers'].join(' ');
		var key = this.service.getShortcut()['key'];
		var keycode = this.service.getShortcut()['keycode'];

		// Remove current key if existing:
		var secureLoginShortCut = this.secureLoginShortCut;
		if (secureLoginShortCut) {
			this.mainKeyset.removeChild(secureLoginShortCut);
		}

		// Check if keyboard shortcut is enabled (either key or keycode set):
		if (key || keycode) {
			// Create a key element:
			var keyNode = document.createElement('key');

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

	hideToolbarButtonUpdate: function () {
		var secureLoginButton = this.secureLoginButton;
		var hideToolbarButton = this.service.secureLoginPrefs.getBoolPref('hideToolbarButton');
		if (!secureLoginButton && !hideToolbarButton) {
			// Add the toolbar button to the toolbar:
			this.installToolbarButton('secureLoginButton');
			secureLoginButton = this.secureLoginButton;
		}
		if (secureLoginButton) {
			secureLoginButton.setAttribute(
				'hidden',
				hideToolbarButton
			);
		}
	},

	installToolbarButton: function (aButtonID, aBeforeNodeID, aToolbarID) {
		aBeforeNodeID = aBeforeNodeID ? aBeforeNodeID : 'urlbar-container';
		aToolbarID = aToolbarID ? aToolbarID : 'navigation-toolbar';
		if (!document.getElementById(aButtonID)) {
			var toolbar = document.getElementById(aToolbarID);
			if (toolbar && 'insertItem' in toolbar) {
				var beforeNode = document.getElementById(aBeforeNodeID);
				if (beforeNode && beforeNode.parentNode != toolbar) {
					beforeNode = null;
				}
				// Insert before the given node or at the end of the toolbar if the node is not available:
				toolbar.insertItem(aButtonID, beforeNode, null, false);
				toolbar.setAttribute('currentset', toolbar.currentSet);
				document.persist(toolbar.id, 'currentset');
			}
		}
	},

	hideToolbarButtonMenuUpdate: function () {
		var secureLoginButton = this.secureLoginButton;
		if (secureLoginButton) {
			if (this.service.secureLoginPrefs.getBoolPref('hideToolbarButtonMenu')) {
				secureLoginButton.removeAttribute('type');
			} else {
				secureLoginButton.setAttribute('type','menu-button');
			}
		}
	},

	hideStatusbarIconUpdate: function () {
		// Change the statusbar icon visibility:
		var secureLoginPanelIcon = this.secureLoginPanelIcon;
		if (secureLoginPanelIcon) {
			secureLoginPanelIcon.setAttribute(
				'hidden',
				this.service.secureLoginPrefs.getBoolPref('hideStatusbarIcon')
			);
		}
	},

	hideToolsMenuUpdate: function () {
		// Change the tools menu visibility:
		var secureLoginToolsMenu = this.secureLoginToolsMenu;
		if (secureLoginToolsMenu) {
			secureLoginToolsMenu.setAttribute(
				'hidden',
				this.service.secureLoginPrefs.getBoolPref('hideToolsMenu')
			);
		}
	},

	hideContextMenuItemUpdate: function () {
		var contentAreaContextMenu = this.contentAreaContextMenu;
		if (contentAreaContextMenu) {
			var isHideContextMenuItem = this.service.secureLoginPrefs.getBoolPref('hideContextMenuItem');
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
				var cm0 = this.secureLoginContextMenuItem;
				var cm1 = this.secureLoginContextMenuMenu;
				var cm2 = this.secureLoginContextMenuSeparator1;
				var cm3 = this.secureLoginContextMenuSeparator2;
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
		this.menuPreparation('secureLoginBookmarkContextItem', 'secureLoginContextAutofillFormsMenu');
	},

	toolsMenu: function (aEvent) {
		this.menuPreparation('secureLoginBookmarkToolsMenuItem', 'secureLoginToolsMenuAutofillFormsMenu');
	},

	buttonMenu: function (aEvent) {
		this.menuPreparation('secureLoginBookmarkButtonMenuItem', 'secureLoginButtonMenuAutofillFormsMenu');
	},

	menuPreparation: function (aBookmarkItemID, aAutofillFormsMenuID) {
		var doc = this.service.getDoc();
		var bookmarkItem = document.getElementById(aBookmarkItemID);
		if (bookmarkItem) {
			if (this.service.secureLoginPrefs.getBoolPref('secureLoginBookmarks') &&
				doc && doc.forms && doc.forms.length > 0) {
				bookmarkItem.setAttribute('disabled', 'false');
			} else {
				bookmarkItem.setAttribute('disabled', 'true');
			}
		}
		var autofillFormsPopupMenu = this.autofillFormsPopupMenu;
		var autofillFormsMenu = document.getElementById(aAutofillFormsMenuID);
		var autofillFormsMenuSeparator = document.getElementById(aAutofillFormsMenuID + 'Separator');
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
			case 0:
				if (aEvent.target.id == 'secureLoginPanelIcon') {
					// The left mouse button already performs the login command for the secureLoginButton,
					// but not for the status bar icon:
					this.service.userSelectionLogin(aEvent);
				}
				break;
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
			if (this.service.secureLogins && this.service.needsRealLoginObjects()) {
				// On Firefox 3 we still have to get the valid login objects:
				this.service.secureLogins = this.service.getRealLoginObjects();

				// Return if the list of login objects is empty (should not happen):
				if(!this.service.secureLogins || this.service.secureLogins.length == 0) {
					return false;
				}
			}
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

	tooltip: function (aEvent) {
		// Check if document.tooltipNode exists and if it is shown above a valid node:
		if (!document.tooltipNode
		    || !document.tooltipNode.hasAttribute('tooltip')
		    || !(document.tooltipNode.id == 'secureLoginButton'
		    || document.tooltipNode.id == 'secureLoginPanelIcon')
		) {
			// Don't show any tooltip:
			aEvent.preventDefault();
			return;
		}

		// Search for valid logins and outline login fields if not done automatically:
		if (!this.service.secureLoginPrefs.getBoolPref('searchLoginsOnload')) {
			this.service.searchLoginsInitialize();
		}

		// Get the tooltip node:
		var tooltip = this.tooltipLoginUrlsList;
		if (tooltip) {
			// Remove all children nodes:
			while (tooltip.hasChildNodes()) {
				tooltip.removeChild(tooltip.firstChild);
			}

			if (this.service.secureLogins && this.service.secureLogins.length > 0) {

				// List of unique action urls:
				var urls = new Array();
				// Helper list to count the number of identical urls:
				var urlsCount = new Array();

				// Go through the forms and find the unique action urls:
				var win;
				var doc;
				var formIndex;
				var url;
				var foundInList;
				for (var i = 0; i < this.service.secureLogins.length; i++) {
					win = this.service.secureLoginsWindow[i];
					// Skip windows which have been closed in the meantime:
					if (win.closed) {
						continue;
					}
					doc = this.service.getDoc(win);
					formIndex = this.service.secureLoginsFormIndex[i];
					url = doc.forms[formIndex].action;
					// If the url is empty, take it from the current document:
					if (!url) {
						url = doc.baseURI;
					}
					foundInList = false;
					// Check if the form action url is already in the list:
					for (var j = 0; j < urls.length; j++) {
						if (urls[j] == url) {
							// url already in the list, increase the counter:
							foundInList = true;
							urlsCount[j]++;
							break;
						}
					}
					if (!foundInList) {
						// Not in list, add the current url:
						urls[j] = url;
						urlsCount[j] = 1;
					}
				}

				if (urls.length) {
					// Add the url list:
					var tooltipLoginURL = document.createElement('description');
					tooltipLoginURL.setAttribute(
					  'class',
					  'secureLoginTooltipUrl'
					);
					var spacer = document.createElement("spacer");
					spacer.setAttribute("flex", "1");
					var tooltipUrlCount = document.createElement('label');
					tooltipUrlCount.setAttribute(
					  'class',
					  'secureLoginTooltipUrlCount'
					);
					for (var i = 0; i < urls.length; i++) {
						let hbox = document.createElement("hbox");
						let descr = tooltipLoginURL.cloneNode(false);
						descr.setAttribute(
						  'value',
						  urls[i]
						);
						let label = tooltipUrlCount.cloneNode(false);
						tooltipUrlCount.setAttribute(
						  'value',
						  '('+urlsCount[i]+')'
						);

						hbox.appendChild(descr);
						hbox.appendChild(spacer.cloneNode(false));
						hbox.appendChild(label);
						tooltip.appendChild(hbox);
					}

					this.tooltipExistLoginBox.removeAttribute("hidden");
					this.tooltipNoLoginBox.hidden = true;
					return;
				}
			}

			this.tooltipNoLoginBox.removeAttribute("hidden");
			this.tooltipExistLoginBox.hidden = true;
		}
	},

	initializeTooltip: function () {
		// Add the login label plus shortcut, if not empty:
		this.tooltipTitleLabel.setAttribute(
		  'value',
		  this.service.stringBundle.getString('tooltipLogin')
		);
		var formattedShortcut = this.service.getFormattedShortcut();
		if (formattedShortcut) {
			this.tooltipKeyboardShortcut.setAttribute(
			  'value',
			  '('+this.service.getFormattedShortcut()+')'
			);
		}

		// Add a description of the URL elements and count:
		this.tooltipUrlHeaderURL.setAttribute(
		  'value',
		  this.service.stringBundle.getString('tooltipLoginUrl')
		);
		this.tooltipUrlHeaderCount.setAttribute(
		  'value',
		  this.service.stringBundle.getString('tooltipLoginUrlCount')
		);

		this.tooltipNoLoginLabel.setAttribute(
		  'value',
		  this.service.stringBundle.getString('tooltipNoLogin')
		);
	},

	finalize: function () {
		this.finalizeToolbarButtonStatus();

		// Remove the content area context menu listener:
		var contentAreaContextMenu = this.contentAreaContextMenu;
		if(contentAreaContextMenu) {
			contentAreaContextMenu.removeEventListener(
				'popupshowing',
				this.contentAreaContextMenuEventListener,
				false
			);
		}

		// Remove the preferences Observer:
		this.service.secureLoginPrefs.removeObserver('', this);
	},

	finalizeToolbarButtonStatus: function () {
		var secureLoginPrefs = this.service.secureLoginPrefs;
		var secureLoginButton = this.secureLoginButton;
		var hideToolbarButton = secureLoginPrefs.getBoolPref('hideToolbarButton');
		if(!secureLoginButton && !hideToolbarButton) {
			// If the toolbar button icon has been removed from the toolbar by drag&drop
			// enable the hideToolbarButton setting:
			secureLoginPrefs.setBoolPref('hideToolbarButton', true);
		} else if(secureLoginButton && !secureLoginButton.getAttribute('hidden')) {
			// If the toolbar button icon has been added to the toolbar by drag&drop
			// disable the hideToolbarButton setting:
			secureLoginPrefs.setBoolPref('hideToolbarButton', false);
		}
	},

};
window.addEventListener("load", secureLoginOverlay, false);
