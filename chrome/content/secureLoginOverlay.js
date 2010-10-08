/*
 * @package secureLogin
 * @author Sebastian Tschan
 * @copyright (c) Sebastian Tschan
 * @license GNU General Public License
 * @link https://blueimp.net/mozilla/
 */
var secureLoginOverlay = {

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

		this.initialize();
	},

	onUnLoad: function() {
		window.removeEventListener("unload", this, false);

		this.finalize();
	},

	observe: function (aSubject, aTopic, aData) {
		// Only observe preferences changes:
		if (aTopic != 'nsPref:changed') {
			return;
		}
		switch (aData) {
			case 'shortcut':
				this.updateShortcut();
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
		}
	},

	initialize: function () {
		// Add a preferences observer to the secureLogin preferences branch:
		this.service.secureLoginPrefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		this.service.secureLoginPrefs.addObserver('', this.service, false);

		this.service.secureLoginPrefs.addObserver('', this, false);// add this to observer.

		// Implement the event listener for the content area context menu:
		this.service.contentAreaContextMenuEventListener = function (event) {
			secureLoginOverlay.initContentAreaContextMenu(event);
		}

		// Initialize the preferences settings:
		this.service.initializePrefs();
		this.initializePrefs();
	},

	initializePrefs: function () {
		// Set the keyboard shortcut:
		this.updateShortcut();

		// Initialize toolbar and statusbar icons and tools and context menus:
		this.hideToolbarButtonUpdate();
		this.hideToolbarButtonMenuUpdate();
		this.hideStatusbarIconUpdate();
		this.hideToolsMenuUpdate();
		this.hideContextMenuItemUpdate();
	},

	initContentAreaContextMenu: function (aEvent) {
		var cm0 = document.getElementById('secureLoginContextMenuItem');
		var cm1 = document.getElementById('secureLoginContextMenuMenu');
		var cm2 = document.getElementById('secureLoginContextMenuSeparator1');
		var cm3 = document.getElementById('secureLoginContextMenuSeparator2');
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
					if (!this.service.getMasterSecurityDevice().getInternalKeyToken().needsLogin()
						|| this.service.getMasterSecurityDevice().getInternalKeyToken().isLoggedIn()) {
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
		if (document.getElementById('secureLoginShortCut')) {
			document.getElementById('mainKeyset').removeChild(
				document.getElementById('secureLoginShortCut')
			);
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
			document.getElementById('mainKeyset').appendChild(keyNode);
		}
	},

	hideToolbarButtonUpdate: function () {
		var secureLoginButton = document.getElementById('secureLoginButton');
		var hideToolbarButton = this.service.secureLoginPrefs.getBoolPref('hideToolbarButton');
		if (!secureLoginButton && !hideToolbarButton) {
			// Add the toolbar button to the toolbar:
			this.installToolbarButton('secureLoginButton');
			secureLoginButton = document.getElementById('secureLoginButton');
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
		var secureLoginButton = document.getElementById('secureLoginButton');
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
		var secureLoginPanelIcon = document.getElementById('secureLoginPanelIcon');
		if (secureLoginPanelIcon) {
			secureLoginPanelIcon.setAttribute(
				'hidden',
				this.service.secureLoginPrefs.getBoolPref('hideStatusbarIcon')
			);
		}
	},

	hideToolsMenuUpdate: function () {
		// Change the tools menu visibility:
		var secureLoginToolsMenu = document.getElementById('secureLoginToolsMenu');
		if (secureLoginToolsMenu) {
			secureLoginToolsMenu.setAttribute(
				'hidden',
				this.service.secureLoginPrefs.getBoolPref('hideToolsMenu')
			);
		}
	},

	hideContextMenuItemUpdate: function () {
		var contentAreaContextMenu = document.getElementById('contentAreaContextMenu');
		if (contentAreaContextMenu) {
			if (!this.service.secureLoginPrefs.getBoolPref('hideContextMenuItem')) {
				// Add the content area context menu listener:
				contentAreaContextMenu.addEventListener(
					'popupshowing',
					this.service.contentAreaContextMenuEventListener,
					false
				);
			} else {
				// Hide the SL contentare context menu entries and remove the content area context menu listener:
				var cm0 = document.getElementById('secureLoginContextMenuItem');
				var cm1 = document.getElementById('secureLoginContextMenuMenu');
				var cm2 = document.getElementById('secureLoginContextMenuSeparator1');
				var cm3 = document.getElementById('secureLoginContextMenuSeparator2');
				if (cm0) {
					cm0.hidden = true;
					cm1.hidden = true;
					cm2.hidden = true;
					cm3.hidden = true;
				}
				contentAreaContextMenu.removeEventListener(
					'popupshowing',
					this.service.contentAreaContextMenuEventListener,
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
		var autofillFormsPopupMenu = document.getElementById('autofillFormsPopupMenu');
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

	finalize: function () {
		this.finalizeToolbarButtonStatus();
		this.service.finalizeSignonAutofillFormsStatus();

		// Remove the content area context menu listener:
		var contentAreaContextMenu = document.getElementById('contentAreaContextMenu');
		if(contentAreaContextMenu) {
			contentAreaContextMenu.removeEventListener(
				'popupshowing',
				this.service.contentAreaContextMenuEventListener,
				false
			);
		}

		// Remove the listener from the browser object:
		try {
			this.service.getBrowser().removeProgressListener(this.service.progressListener);
		} catch(e) {
			this.service.log(e);
		}

		// Remove the preferences Observer:
		this.service.secureLoginPrefs.removeObserver('', this.service);
		this.service.secureLoginPrefs.removeObserver('', this);
	},

	finalizeToolbarButtonStatus: function () {
		var secureLoginButton = document.getElementById('secureLoginButton');
		var hideToolbarButton = this.service.secureLoginPrefs.getBoolPref('hideToolbarButton');
		if(!secureLoginButton && !hideToolbarButton) {
			// If the toolbar button icon has been removed from the toolbar by drag&drop
			// enable the hideToolbarButton setting:
			this.service.secureLoginPrefs.setBoolPref('hideToolbarButton', true);
		} else if(secureLoginButton && !secureLoginButton.getAttribute('hidden')) {
			// If the toolbar button icon has been added to the toolbar by drag&drop
			// disable the hideToolbarButton setting:
			this.service.secureLoginPrefs.setBoolPref('hideToolbarButton', false);
		}
	},

};
window.addEventListener("load", secureLoginOverlay, false);
