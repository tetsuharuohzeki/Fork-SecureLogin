/*
 * @package secureLogin
 * @author Sebastian Tschan
 * @copyright (c) Sebastian Tschan
 * @license GNU General Public License
 * @link https://blueimp.net/mozilla/
 */

var secureLogin = {

	// Secure Logins preferences branch:
	get secureLoginPrefs () {
		delete this.secureLoginPrefs;
		return this.secureLoginPrefs = this.getPrefManager()
		                               .getBranch('extensions.secureLogin@blueimp.net.');
	},

	// The progress listener:
	get progressListener () {
		delete this.progressListener;
		var self = this;
		// Implement the listener methods:
		this.progressListener = {
			QueryInterface: function (aIID) {
				if(aIID.equals(Components.interfaces.nsIWebProgressListener) ||
					aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
					aIID.equals(Components.interfaces.nsISupports))
					return this;
				throw Components.results.NS_NOINTERFACE;
			},
			onStateChange: function (aProgress, aRequest, aFlag, aStatus) {
				// Update status when load finishes:
				if(aFlag & Components.interfaces.nsIWebProgressListener.STATE_STOP) {
					self.updateStatus(aProgress, aRequest, null, aFlag, aStatus);
				}
			},
			// Update status when location changes (tab change):
			onLocationChange: function (aProgress, aRequest, aLocation) {
				self.updateStatus(aProgress, aRequest, aLocation, null, null);
			},
			onProgressChange: function (a,b,c,d,e,f) {},
			onStatusChange: function (a,b,c,d) {},
			onSecurityChange: function (a,b,c) {},
			onLinkIconAvailable: function (a) {}
		};
		return this.progressListener;
	},

	// Variable to define if the progress listener has been registered to the browser:
	isProgressListenerRegistered: null,
	// Helper var to remember original autofillForms setting (this has nothing to to with the extension autofillForms@blueimp.net:
	autofillForms: null,
	// Valid logins list:
	secureLogins: null,
	// Helper list to store the form index:
	secureLoginsFormIndex: null,
	// Helper list to store the document window (frame):
	secureLoginsWindow: null,
	// Helper list to store the username field:
	secureLoginsUserField: null,
	// Helper list to store the password field:
	secureLoginsPassField: null,
	// Defines if form index is to be shown in selection prompt:
	showFormIndex: null,
	// Object containing the shortcut information (modifiers, key or keycode):
	shortcut: null,
	// Helper var to remember a failed bookmark-login attempt:
	failedBookmarkLogin: null,
	// Event listener for the content area context menu:
	contentAreaContextMenuEventListener: null,

	// autoLogin exceptions list:
	autoLoginExceptions: null,

	initialize: function () {
		// Add a preferences observer to the secureLogin preferences branch:
		this.secureLoginPrefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		this.secureLoginPrefs.addObserver('', this, false);

		// Implement the event listener for the content area context menu:
		this.contentAreaContextMenuEventListener = function (event) {
			secureLogin.initContentAreaContextMenu(event);
		}

		// Initialize the preferences settings:
		this.initializePrefs();
	},

	initContentAreaContextMenu: function (aEvent) {
		var cm0 = document.getElementById('secureLoginContextMenuItem');
		var cm1 = document.getElementById('secureLoginContextMenuMenu');
		var cm2 = document.getElementById('secureLoginContextMenuSeparator1');
		var cm3 = document.getElementById('secureLoginContextMenuSeparator2');
		if (cm0 && gContextMenu) {
			if (this.secureLoginPrefs.getBoolPref('hideContextMenuItem')
				|| gContextMenu.isContentSelected
				|| gContextMenu.onTextInput
				|| gContextMenu.onImage
				|| gContextMenu.onLink
				|| gContextMenu.onCanvas
				|| gContextMenu.onMathML
				|| !this.getDoc().forms
				|| !this.getDoc().forms.length) {
				cm0.hidden = true;
				cm1.hidden = true;
				cm2.hidden = true;
				cm3.hidden = true;
			} else {
				// Search for valid logins and outline login fields if not done automatically:
				if (!this.secureLoginPrefs.getBoolPref('searchLoginsOnload')) {
					this.searchLoginsInitialize();
				}
				if (!this.secureLogins || !this.secureLogins.length) {
					cm0.hidden = true;
					cm1.hidden = true;
					cm2.hidden = true;
					cm3.hidden = true;
				} else {
					// Determine if no master password is set or the user has already been authenticated:
					var masterPasswordRequired = true;
					if (!this.getMasterSecurityDevice().getInternalKeyToken().needsLogin()
						|| this.getMasterSecurityDevice().getInternalKeyToken().isLoggedIn()) {
						masterPasswordRequired = false;
					}
					// Show the menu or the menu item depending on the numer of logins and the MSD status:
					if (this.secureLogins.length > 1 && !masterPasswordRequired) {
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

	initializeSignonAutofillFormsStatus: function () {
		// Disable the prefilling of login forms if enabled, remember status:
		try {
			var rootPrefBranch = this.getPrefManager().getBranch('');
			if (rootPrefBranch.getBoolPref('signon.autofillForms')) {
				rootPrefBranch.setBoolPref('signon.autofillForms', false);
				this.autofillForms = true;
			} else {
				this.autofillForms = false;
			}
		} catch (e) {
			this.log(e);
		}
	},

	initializePrefs: function () {
		this.initializeSignonAutofillFormsStatus();

		// Add the progress listener to the browser, set the Secure Login icons:
		this.searchLoginsOnloadUpdate();

		// Set the keyboard shortcut:
		this.updateShortcut();
	
		// Initialize toolbar and statusbar icons and tools and context menus:
		this.hideToolbarButtonUpdate();
		this.hideToolbarButtonMenuUpdate();
		this.hideStatusbarIconUpdate();
		this.hideToolsMenuUpdate();
		this.hideContextMenuItemUpdate();
		this.javascriptProtectionUpdate();
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
			case 'searchLoginsOnload':
				this.searchLoginsOnloadUpdate();
				break;
			case 'secureLoginBookmarks':
				this.secureLoginBookmarksUpdate();
				break;
			case 'highlightColor':
				this.highlightColorUpdate();
				break;
			case 'javascriptProtection':
				this.javascriptProtectionUpdate();
				break;
			case 'autoLoginExceptions':
				this.autoLoginExceptions = null;
				break;
		}
	},

	changePref: function (aEvent, aPref) {
		// Attribute 'checked' is empty or true, setting must be false or true:
		this.secureLoginPrefs.setBoolPref(
			aPref,
			!!aEvent.target.getAttribute('checked')
		);
	},

	progressListenerUpdate: function () {
		if (!this.secureLoginPrefs.getBoolPref('searchLoginsOnload') && !this.secureLoginPrefs.getBoolPref('secureLoginBookmarks')) {
			// Remove the listener from the browser object (if added previously):
			try {
				this.getBrowser().removeProgressListener(this.progressListener);
				this.isProgressListenerRegistered = false;
			} catch (e) {
				this.log(e);
			}
		} else if (!this.isProgressListenerRegistered && 
			(this.secureLoginPrefs.getBoolPref('searchLoginsOnload') || this.secureLoginPrefs.getBoolPref('secureLoginBookmarks'))) {
			// Add the progress listener to the browser object (if not added previously):
			try {
				this.getBrowser().addProgressListener(
					this.progressListener,
					Components.interfaces.nsIWebProgress.NOTIFY_LOCATION | Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT
				);
				this.isProgressListenerRegistered = true;
			} catch (e) {
				this.log(e);
			}
		}
	},

	searchLoginsOnloadUpdate: function () {
		this.progressListenerUpdate();

		if (this.secureLoginPrefs.getBoolPref('searchLoginsOnload')) {
			// Search for valid logins and outline login fields:
			this.searchLoginsInitialize();
		} else {
			// Always highlight the Secure Login icons, when not searching for valid logins automatically:
			var secureLoginPanelIcon = document.getElementById('secureLoginPanelIcon');
			if (secureLoginPanelIcon) {
				secureLoginPanelIcon.setAttribute(
					'class',
					'statusbarpanel-menu-iconic secureLoginIcon'
				);
			}
			var secureLoginButton = document.getElementById('secureLoginButton');
			if (secureLoginButton) {
				secureLoginButton.setAttribute(
					'class',
					'toolbarbutton-1 secureLoginButton'
				);
			}
		}
	},

	secureLoginBookmarksUpdate: function () {
		if (this.secureLoginPrefs.getCharPref('secureLoginBookmarkHash') == '#secureLoginBookmark') {
			// Create a random Secure Login Bookmark hash (anchor) if the default is still set:
			// This slightly increases security and avoids unwanted auto-logins
			this.secureLoginPrefs.setCharPref('secureLoginBookmarkHash', '#slb'+Math.ceil(Math.random()*1000000000));
		}

		this.progressListenerUpdate();
	},

	highlightColorUpdate: function () {
		if (this.secureLoginsPassField) {
			// The outline style:
			var outlineStyle = ''
								+ this.secureLoginPrefs.getIntPref('highlightOutlineWidth')
								+ 'px '
								+ this.secureLoginPrefs.getCharPref('highlightOutlineStyle')
								+ ' '
								+ this.secureLoginPrefs.getCharPref('highlightColor');
			
			// Update the outlined form fields:
			for (var i = 0; i < this.secureLoginsPassField.length; i++) {
				// Outline the username field if existing:
				if (this.secureLoginsUserField[i])
					this.secureLoginsUserField[i].style.outline = outlineStyle;
				// Outline the password field if existing:
				if (this.secureLoginsPassField[i])
					this.secureLoginsPassField[i].style.outline = outlineStyle;
			}
		}
	},

	installToolbarButton: function (aButtonID, aBeforeNodeID, aToolbarID) {
		aBeforeNodeID = aBeforeNodeID ? aBeforeNodeID : 'urlbar-container';
		aToolbarID = aToolbarID ? aToolbarID : 'navigation-toolbar';
		if (!document.getElementById(aButtonID)) {
			var toolbar = document.getElementById(aToolbarID);
			if (toolbar && 'insertItem' in toolbar) {
				var beforeNode = document.getElementById(aBeforeNodeID);
				if(beforeNode && beforeNode.parentNode != toolbar) {
					beforeNode = null;
				}
				// Insert before the given node or at the end of the toolbar if the node is not available:
				toolbar.insertItem(aButtonID, beforeNode, null, false);
				toolbar.setAttribute('currentset', toolbar.currentSet);
				document.persist(toolbar.id, 'currentset');
			}
		}
	},

	hideToolbarButtonUpdate: function () {
		var secureLoginButton = document.getElementById('secureLoginButton');
		var hideToolbarButton = this.secureLoginPrefs.getBoolPref('hideToolbarButton');
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

	hideToolbarButtonMenuUpdate: function () {
		var secureLoginButton = document.getElementById('secureLoginButton');
		if (secureLoginButton) {
			if (this.secureLoginPrefs.getBoolPref('hideToolbarButtonMenu')) {
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
				this.secureLoginPrefs.getBoolPref('hideStatusbarIcon')
			);
		}
	},

	hideToolsMenuUpdate: function () {
		// Change the tools menu visibility:
		var secureLoginToolsMenu = document.getElementById('secureLoginToolsMenu');
		if (secureLoginToolsMenu) {
			secureLoginToolsMenu.setAttribute(
				'hidden',
				this.secureLoginPrefs.getBoolPref('hideToolsMenu')
			);
		}
	},

	hideContextMenuItemUpdate: function () {
		var contentAreaContextMenu = document.getElementById('contentAreaContextMenu');
		if (contentAreaContextMenu) {
			if (!this.secureLoginPrefs.getBoolPref('hideContextMenuItem')) {
				// Add the content area context menu listener:
				contentAreaContextMenu.addEventListener(
					'popupshowing',
					this.contentAreaContextMenuEventListener,
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
					this.contentAreaContextMenuEventListener,
					false
				);
			}
		}
	},

	javascriptProtectionUpdate: function () {
		document.getElementById('secureLoginJavascriptProtection').setAttribute(
				'checked',
				this.secureLoginPrefs.getBoolPref('javascriptProtection')
		);
	},
	
	updateStatus: function (aProgress, aRequest, aLocation, aFlag, aStatus) {
		var progressWindow = aProgress.DOMWindow;

		if (this.secureLoginPrefs.getBoolPref('searchLoginsOnload')) {
			// Initialize the recursive search for logins on the current window:
			this.searchLoginsInitialize(progressWindow);

			var doc = this.getDoc(progressWindow);

			if (this.secureLoginPrefs.getBoolPref('autoLogin')
				&& this.secureLogins && this.secureLogins.length > 0
				&& (!this.secureLoginPrefs.getBoolPref('secureLoginBookmarks')
					|| (doc.location.hash.indexOf(this.secureLoginPrefs.getCharPref('secureLoginBookmarkHash')) != 0))
				&& !this.inArray(this.getAutoLoginExceptions(), doc.location.protocol + '//' + doc.location.host)
				) {
				// Auto-Login if enabled, logins have been found, URL is not a Secure Login bookmark
				// and the current website is not in the autoLoginExceptions list:
				this.login(progressWindow);
			}
		}

		if (this.secureLoginPrefs.getBoolPref('secureLoginBookmarks')) {
			// Auto-Login if the current URL is a Secure Login Bookmark:
			this.bookmarkLogin(progressWindow);
		}
	},

	getAutoLoginExceptions: function () {
		if (!this.autoLoginExceptions) {
			// Get the exception list from the preferences:
			this.autoLoginExceptions = this.secureLoginPrefs
										.getComplexValue('autoLoginExceptions',Components.interfaces.nsISupportsString)
										.data.split(' ');
		}
		return this.autoLoginExceptions;
	},
	
	bookmarkLogin: function (aWin) {
		var doc = this.getDoc(aWin);

		// Check for first four characters of Secure Login anchor (hash):
		if (doc && doc.location && doc.location.hash
			&& doc.location.hash.substr(0, 4) == this.secureLoginPrefs.getCharPref('secureLoginBookmarkHash').substr(0, 4)) {

			// Check for complete Secure Login anchor (hash):
			var index = doc.location.hash.indexOf(this.secureLoginPrefs.getCharPref('secureLoginBookmarkHash'));
			if (index == 0) {
				var bookmarkLoginIndex = parseInt(
					doc.location.hash.substr(
						this.secureLoginPrefs.getCharPref('secureLoginBookmarkHash').length
					)
				);
				if (!isNaN(bookmarkLoginIndex)) {
					// Auto-Login using the bookmarkLoginIndex:
					this.login(aWin, bookmarkLoginIndex);
				} else {
					// Auto-Login:
					this.login(aWin);
				}
			} else {
				// Remember failed bookmark-login attempt:
				this.failedBookmarkLogin = true;
			}
		}
	},

	searchLoginsInitialize: function (aWin) {
		if (!aWin || !aWin.document) {
			aWin = this.getWin();
		}

		if (this.secureLogins && aWin.frameElement) {
			// Login search initialized by a frame window - keep the logins of all remaining windows:
			for (var i=0; i<this.secureLogins.length; i++) {
				if (this.secureLoginsWindow[i] == aWin || this.secureLoginsWindow[i].closed) {
					this.secureLogins.splice(i, 1);
					this.secureLoginsFormIndex.splice(i, 1);
					this.secureLoginsWindow.splice(i, 1);
					this.secureLoginsUserField.splice(i, 1);
					this.secureLoginsPassField.splice(i, 1);
				}
			}
		} else {
			// Reset the found logins and helper lists:
			this.secureLogins = null;
			this.secureLoginsFormIndex = null;
			this.secureLoginsWindow = null;
			this.secureLoginsUserField = null;
			this.secureLoginsPassField = null;
		}

		// Show form index only if more than one valid login form is found:
		this.showFormIndex = false;

		// Search for valid logins on the given window:
		this.searchLogins(aWin);

		if (this.secureLoginPrefs.getBoolPref('searchLoginsOnload')) {
			this.updateLoginsFoundStatus();
		}
	},

	updateLoginsFoundStatus: function () {
		var secureLoginPanelIcon = document.getElementById('secureLoginPanelIcon');
		var secureLoginButton = document.getElementById('secureLoginButton');
		if (this.secureLogins && this.secureLogins.length > 0) {
			if (secureLoginPanelIcon) {
				secureLoginPanelIcon.setAttribute(
					'class',
					'statusbarpanel-menu-iconic secureLoginIcon'
				);
			}
			if (secureLoginButton) {
				secureLoginButton.setAttribute(
					'class',
					'toolbarbutton-1 secureLoginButton'
				);
			}
			// Play sound notification:
			if (this.secureLoginPrefs.getBoolPref('playLoginFoundSound')) {
				this.playSound('loginFoundSoundFileName');
			}
		} else {
			if (secureLoginPanelIcon) {
				secureLoginPanelIcon.setAttribute(
					'class',
					'statusbarpanel-menu-iconic secureLoginIconDisabled'
				);
			}
			if (secureLoginButton) {
				secureLoginButton.setAttribute(
					'class',
					'toolbarbutton-1 secureLoginButtonDisabled'
				);
			}
		}
	},

	searchLogins: function (aWin) {
		var doc = this.getDoc(aWin);

		// Check if any web forms are available on the current window:
		if (doc && doc.forms && doc.forms.length > 0 && doc.location) {

			// document (current) host:
			var host = doc.location.protocol + '//' + doc.location.host;

			var formURIs = new Array();

			// Go through the forms:
			for (var i = 0; i < doc.forms.length; i++) {

				var formAction = doc.forms[i].action;
				if (!formAction) {
					// Forms with no "action" attribute default to submitting to their origin URL:
					formAction = doc.baseURI;
				}

				try {
					// Create a nsIURI object from the formAction:
					var formURI = this.makeURI(formAction, doc.characterSet);
					var targetHost = formURI.prePath;			
				} catch(e) {
					// The forms seems not to have a valid "action" attribute, continue:
					this.log(e);
					continue;
				}

				if (this.secureLoginPrefs.getBoolPref('skipDuplicateActionForms')) {
					// Skip this form if the same formURI has already been added:
					var isDuplicate = false;
					for (var j = 0; j< formURIs.length; j++) {
						if(formURIs[j].equals(formURI)) {
							isDuplicate = true;
							break;
						}
					}
					if (isDuplicate) {
						continue;
					}
				}

				// Getting the number of existing logins with countLogins() instead of findLogins() to avoid a Master Password prompt:
				var loginsCount = this.getLoginManager().countLogins(host, targetHost, null);

				if (loginsCount) {
					// Get valid login fields:
					var loginFields = this.getLoginFields(doc.forms[i], null, null);

					if (loginFields) {
						if (this.secureLoginPrefs.getBoolPref('skipDuplicateActionForms')) {
							// Add the formURI to the list:
							formURIs.push(formURI);
						}

						// Go through the logins:
						for (var j = 0; j < loginsCount; j++) {
							// Add null as login object to the logins list to avoid a Master Password prompt:
							this.addToFoundLoginsList(null, i, aWin, loginFields.username, loginFields.password);

							// highlight login fields:
							this.highlightLoginFields(loginFields.username, loginFields.password);
				 		}
			 		}
				}
			}
		}

		// Recursive call for all subframes:
		for (var f=0; f < aWin.frames.length; f++) {
			this.searchLogins(aWin.frames[f]);
		}
	},

	getRealLoginObjects: function () {
		// Method for Firefox 3 to get the real login objects instead of the null values:

		var loginObjects = new Array();

		if (this.secureLogins) {
			// Go through the collected dummy login objects (null values):
			for (var i=0; i < this.secureLogins.length; i++) {
				var win = this.secureLoginsWindow[i];
				// Skip windows which have been closed in the meantime:
				if (win.closed) {
					continue;
				}
				var doc = this.getDoc(win);
				var formIndex = this.secureLoginsFormIndex[i];
				
				var host = doc.location.protocol + '//' + doc.location.host;
				var targetHost;
				if (doc.forms[formIndex].action) {
					try {
						targetHost = this.makeURI(doc.forms[formIndex].action, doc.characterSet).prePath;
					} catch (e) {
						// The forms seems not to have a valid "acion" attribute, continue:
						this.log(e);
						continue;
					}
				} else {
					// Forms with no "action" attribute default to submitting to their origin URL:
					targetHost = host;
				}

				try {
					// This should return some login objects, as countLogins() had not returned 0 either:
					var logins = this.getLoginManager().findLogins({}, host, targetHost, null);
					// Make sure the saved passwords have not been deleted in the meanwhile:
					if (logins && logins.length) {
						loginObjects = loginObjects.concat(logins);				
						// Skip the next iterations for the number of found logins (-1 as i++ increases the counter already +1):
						i = i + logins.length -1;
					} else {
						// Re-initialize the logins search and break out of the loop:
						this.searchLoginsInitialize();
						break;
					}
				} catch (e) {
					this.log(e);
					// User cancelled master password entry, so we break out of the loop:
					break;
				}
			}
		}

		return loginObjects;
	},

	getLoginFields: function (aForm, aLoginUsernameFieldName, aLoginPasswordFieldName) {

		// The form fields for user+pass:
		var usernameField = null;
		var passwordField = null;

		// helper var to define if the login form is a password only form:
		var inputTextFound = false;

		// The form elements list:
		var elements = aForm.elements;
		
		// Go through the form elements:
		for (var i = 0; i < elements.length; i++) {
			// Skip disabled elements or elements without a "name":
			if (!elements[i].name || elements[i].disabled) {
				continue;
			}
			if (elements[i].type == 'text') {
				// input of type "text" found, this is no password only form:
				inputTextFound = true;

				// We do not get a loginUsernameFieldName from Firefox 3:
				if (!aLoginUsernameFieldName) {
					// Assume the first text field followed by a password field is the username field
					// Use another loop to skip non-text fields (e.g. checkboxes) between:
					for (var j = i+1; j < elements.length; j++) {
						if (elements[j].type == 'password') {
							// Following password field found so the username field might be valid:
							usernameField = elements[i];
							break;
						}
						if (elements[j].type == 'text') {
							// Another textfield found, this might be the username field, so break out of the loop:
							break;
						}
					}
				} else {
					if (elements[i].name == aLoginUsernameFieldName) {
						usernameField = elements[i];
					}
				}
			} else if (elements[i].type == 'password') {
				// We do not get a loginPasswordFieldName from Firefox 3:
				if (!aLoginPasswordFieldName) {
					// Skip registration or password change forms (two password fields):
					if (!(elements[i+1] && elements[i+1].type == 'password')) {
						passwordField = elements[i];
					}
				} else {
					// Skip registration or password change forms (two password fields):
					if (!(elements[i+1] && elements[i+1].type == 'password') && elements[i].name == aLoginPasswordFieldName) {
						passwordField = elements[i];
					}
				}

				// We found a password field so break out of the loop:
				break;
			}
		}

		if (passwordField) {
			// If this is a password only form, no input of type "text" may be found and userFieldName must be empty:
			if (!usernameField && (inputTextFound || loginUsernameFieldName)) {
				return null;
			}

			var loginFields = new Object();
			loginFields.username = usernameField;
			loginFields.password = passwordField;

			return loginFields;
		}
		return null;
	},

	addToFoundLoginsList: function(aLoginObject, aFormIndex, aWindowObject, aUsernameField, aPasswordField) {
		// Lazy initialization of the logins and helper lists:
		if (!this.secureLogins) {
			// New valid logins list:
			this.secureLogins = new Array();
			// New helper list to store the form index:
			this.secureLoginsFormIndex = new Array();
			// New helper list to store the document window (frame):
			this.secureLoginsWindow = new Array();
			// New helper list to store the username field:
			this.secureLoginsUserField = new Array();
			// New helper list to store the password field:
			this.secureLoginsPassField = new Array();
		}

		var loginIndex = this.secureLogins.length;

		// Test if there is only one valid login form:
		if (!this.showFormIndex && loginIndex > 0 && !this.inArray(this.secureLoginsFormIndex, aFormIndex)) {
			this.showFormIndex = true;
		}

		// Save the login in the valid logins list:
		this.secureLogins[loginIndex] = aLoginObject;
		// Save the form index in the list:
		this.secureLoginsFormIndex[loginIndex] = aFormIndex;
		// Save the current document window (frame) in the list:
		this.secureLoginsWindow[loginIndex] = aWindowObject;
		// Save the username field in the list:
		this.secureLoginsUserField[loginIndex] = aUsernameField;
		// Save the password field in the list:
		this.secureLoginsPassField[loginIndex] = aPasswordField;
	},

	highlightLoginFields: function (aUsernameField, aPasswordField) {
		// Possible style declaration, overwriting outline settings:
		var highlightStyle = this.secureLoginPrefs.getCharPref('highlightStyle');

		if (!highlightStyle) {
			if (!this.secureLoginPrefs.getIntPref('highlightOutlineWidth')) {
				// No visible style set, return:
				return;
			}

			// The outline style:
			var outlineStyle = ''
								+ this.secureLoginPrefs.getIntPref('highlightOutlineWidth')
								+ 'px '
								+ this.secureLoginPrefs.getCharPref('highlightOutlineStyle')
								+ ' '
								+ this.secureLoginPrefs.getCharPref('highlightColor');

			// The outline radius:
			var outlineRadius = this.secureLoginPrefs.getIntPref('highlightOutlineRadius');
		}

		// Outline usernameField:
		if (aUsernameField) {
			// Overwrite style if set:
			if (highlightStyle) {
				aUsernameField.setAttribute('style', highlightStyle);
			} else {
				aUsernameField.style.outline = outlineStyle;
	    		if (outlineRadius) {
					aUsernameField.style.setProperty(
						'-moz-outline-radius',
						outlineRadius+'px',
						null
					);
				}
			}
		}

		// Overwrite highlight style if set:
		if (highlightStyle) {
			aPasswordField.setAttribute('style', highlightStyle);
		} else {
			// outline the password field:
			aPasswordField.style.outline = outlineStyle;
			if (outlineRadius) {
				aPasswordField.style.setProperty(
					'-moz-outline-radius',
					outlineRadius+'px',
					null
				);
			}
		}
	},

	tooltip: function (aEvent) {
		// Check if document.tooltipNode exists and if it is shown above a valid node:
		if (!document.tooltipNode || !document.tooltipNode.hasAttribute('tooltip')
			|| !(document.tooltipNode.id == 'secureLoginButton' || document.tooltipNode.id == 'secureLoginPanelIcon')) {
			// Don't show any tooltip:
			aEvent.preventDefault();
			return;
		}

		// Search for valid logins and outline login fields if not done automatically:
		if (!this.secureLoginPrefs.getBoolPref('searchLoginsOnload')) {
			this.searchLoginsInitialize();
		}

		// Get the tooltip node:
		var tooltip = document.getElementById('secureLoginTooltip');
		if (tooltip) {
			// Remove all children nodes:
			while (tooltip.hasChildNodes()) {
				tooltip.removeChild(tooltip.firstChild);
			}

			if (this.secureLogins && this.secureLogins.length > 0) {

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
				for (var i = 0; i < this.secureLogins.length; i++) {
					win = this.secureLoginsWindow[i];
					// Skip windows which have been closed in the meantime:
					if (win.closed) {
						continue;
					}
					doc = this.getDoc(win);
					formIndex = this.secureLoginsFormIndex[i];
					url = doc.forms[formIndex].action;
					// If the url is empty, take it from the current document:
					if (!url) {
						url = doc.baseURI;
					}
					foundInList = false;
					// Check if the form action url is already in the list:
					for (var j = 0; j < urls.length; j++) {
						if(urls[j] == url) {
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
					// Add the login label plus shortcut, if not empty:
					var hbox = document.createElement('hbox');
					hbox.setAttribute(
						'id',
						'secureLoginTooltipTitle'
					);
					var label = document.createElement('label');
					label.setAttribute(
						'id',
						'secureLoginTooltipTitleLabel'
					);
					label.setAttribute(
						'value',
						this.getStringBundle().getString('tooltipLogin')
					);
					hbox.appendChild(label);
					var formattedShortcut = this.getFormattedShortcut();
					if (formattedShortcut) {
						label = label.cloneNode(false);
						label.setAttribute(
							'id',
							'secureLoginTooltipKeyboardShortcut'
						);
						label.setAttribute(
							'value',
							'('+this.getFormattedShortcut()+')'
						);
						hbox.appendChild(label);
					}
					tooltip.appendChild(hbox);

					// Add a description of the URL elements and count:
					hbox = hbox.cloneNode(false);
					hbox.setAttribute(
						'id',
						'secureLoginTooltipUrls'
					);
					label = label.cloneNode(false);
					label.removeAttribute('id');
					label.setAttribute(
						'class',
						'secureLoginTooltipUrlHeader'
					);
					label.setAttribute(
						'value',
						this.getStringBundle().getString('tooltipLoginUrl')
					);
					hbox.appendChild(label);
					var spacer = document.createElement('spacer');
					spacer.setAttribute('flex','1');
					hbox.appendChild(spacer);
					label = label.cloneNode(false);
					label.setAttribute(
						'value',
						this.getStringBundle().getString('tooltipLoginUrlCount')
					);
					hbox.appendChild(label);
					tooltip.appendChild(hbox)
					
					// Add the url list:
					hbox = hbox.cloneNode(false);
					hbox.setAttribute(
						'class',
						'secureLoginTooltipUrlRow'
					);
					var descr = document.createElement('description');
					descr.setAttribute(
						'class',
						'secureLoginTooltipUrl'
					);
					label = label.cloneNode(false);
					label.setAttribute(
						'class',
						'secureLoginTooltipUrlCount'
					);
					for (var i = 0; i < urls.length; i++) {
						hbox = hbox.cloneNode(false);
						descr = descr.cloneNode(false);
						descr.setAttribute(
							'value',
							urls[i]
						);
						hbox.appendChild(descr);
						hbox.appendChild(spacer.cloneNode(false));
						label = label.cloneNode(false);
						label.setAttribute(
							'value',
							'('+urlsCount[i]+')'
						);
						hbox.appendChild(label);
						tooltip.appendChild(hbox);
					}

					return;
				}
			}

			var label = document.createElement('label');
			label.setAttribute(
				'value',
				this.getStringBundle().getString('tooltipNoLogin')
			);
			tooltip.appendChild(label);
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
		var doc = this.getDoc();
		var bookmarkItem = document.getElementById(aBookmarkItemID);
		if (bookmarkItem) {
			if (this.secureLoginPrefs.getBoolPref('secureLoginBookmarks') &&
				doc && doc.forms && doc.forms.length > 0) {
				bookmarkItem.setAttribute('disabled', 'false');
			} else {
				bookmarkItem.setAttribute('disabled', 'true');
			}
		}
		var autofillFormsPopupMenu = document.getElementById('autofillFormsPopupMenu');
		var autofillFormsMenu = document.getElementById(aAutofillFormsMenuID);
		var autofillFormsMenuSeparator = document.getElementById(aAutofillFormsMenuID + 'Separator');
		if (this.secureLoginPrefs.getBoolPref('autofillFormsOnLogin') && autofillFormsPopupMenu) {
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
					this.userSelectionLogin(aEvent);
				}
				break;
			case 1:
				this.masterSecurityDeviceLogout(aEvent);
				break;
		}
	},

	_getMasterSecurityDevice: null,
	getMasterSecurityDevice: function () {
		if (!this._getMasterSecurityDevice) {
			this._getMasterSecurityDevice = Components.classes['@mozilla.org/security/pk11tokendb;1']
			                                .getService(Components.interfaces.nsIPK11TokenDB);
		}
		return this._getMasterSecurityDevice;
	},

	masterSecurityDeviceLogout: function (aEvent) {
		if(this.getMasterSecurityDevice().getInternalKeyToken().isLoggedIn()) {
			this.getMasterSecurityDevice().findTokenByName('').logoutAndDropAuthenticatedResources();
		}
		this.showAndRemoveNotification(this.getStringBundle().getString('masterSecurityDeviceLogout'));
	},

	showAndRemoveNotification: function (aLabel, aTimeout, aId, aImage, aPriority, aButtons) {
		aTimeout = aTimeout ? aTimeout : this.secureLoginPrefs.getIntPref('defaultNotificationTimeout');
		aId = aId ? aId : 'secureLoginNotification';
		aImage = aImage ? aImage : this.secureLoginPrefs.getCharPref('defaultNotificationImage');
		aPriority = aPriority ? aPriority : 'PRIORITY_INFO_HIGH';
		aButtons = aButtons ? aButtons : null;
		this.showNotification(aLabel, aId, aImage, aPriority, aButtons);
		// Automatically remove the notification after the timeout:
		window.setTimeout(
			function() {
				secureLogin.removeNotification()
			},
			aTimeout
		);
	},

	showNotification: function (aLabel, aId, aImage, aPriority, aButtons) {
		aId = aId ? aId : 'secureLoginNotification';
		aImage = aImage ? aImage : this.secureLoginPrefs.getCharPref('defaultNotificationImage');
		aPriority = aPriority ? aPriority : 'PRIORITY_INFO_HIGH';
		aButtons = aButtons ? aButtons : null;
		// First remove notifications with the same id:
		this.removeNotification(aId);
		var notificationBox = this.getBrowser().getNotificationBox();
		if(notificationBox) {
			notificationBox.appendNotification(
				aLabel,
				aId,
				aImage,
				aPriority,
				aButtons
			);
		}
	},

	removeNotification: function (aId) {
		aId = aId ? aId : 'secureLoginNotification';
		var notificationBox = this.getBrowser().getNotificationBox();
		if(notificationBox) {
			var notification = notificationBox.getNotificationWithValue(aId);
			if(notification) {
				notificationBox.removeNotification(notification);
			}
		}
	},

	needsRealLoginObjects: function () {
		// Check if any of the login objects is still null (might happen with frames):
		for (var i = 0; i < this.secureLogins.length; i++) {
			if (!this.secureLogins[i]) {
				return true;
			}
		}
		return false;
	},

	contextMenuSelectionLogin: function (aPopup) {
		try {
			if (this.secureLogins && this.needsRealLoginObjects()) {
				// On Firefox 3 we still have to get the valid login objects:
				this.secureLogins = this.getRealLoginObjects();

				// Return if the list of login objects is empty (should not happen):
				if(!this.secureLogins || this.secureLogins.length == 0) {
					return false;
				}
			}
			this.prepareUserSelectionPopup(aPopup);
		} catch (e) {
			this.log(e);
			// Decrypting failed
			return false;
		}
	},

	prepareUserSelectionPopup: function (aPopup) {
		// Remove the old child nodes (should be already removed by the popuphiding event):
		while (aPopup.hasChildNodes()) {
			aPopup.removeChild(aPopup.firstChild);
		}
		if(this.secureLogins) {
			var menuitem = document.createElement('menuitem');
			menuitem.setAttribute('class','menuitem-iconic secureLoginUserIcon');
			// Add a menuitem for each available user login:
			for(var i = 0; i < this.secureLogins.length; i++) {
				var username = this.getUsernameFromLoginObject(this.secureLogins[i]);
				// Show form index?
				if(this.showFormIndex) {
					username += '  (' + this.secureLoginsFormIndex[i] + ')';
				}
				menuitem = menuitem.cloneNode(false);
				menuitem.setAttribute('label',username);
				menuitem.setAttribute('oncommand','secureLogin.login(null, '+i+', true);');
				aPopup.appendChild(menuitem);
			}
		}
	},

	userSelectionLogin: function (aEvent) {
		if(aEvent.ctrlKey) {
			this.masterSecurityDeviceLogout();
			return;
		}

		// Search for valid logins and outline login fields if not done automatically:
		if(!this.secureLoginPrefs.getBoolPref('searchLoginsOnload')) {
			this.searchLoginsInitialize();
		}

		// Check for valid logins:
		if (this.secureLogins && this.secureLogins.length > 0) {
			if(this.secureLogins.length > 1) {
				// Determine if no master password is set or the user has already been authenticated:
				var masterPasswordRequired = true;
				if (!this.getMasterSecurityDevice().getInternalKeyToken().needsLogin()
					|| this.getMasterSecurityDevice().getInternalKeyToken().isLoggedIn()) {
					masterPasswordRequired = false;
				}
				var popup = document.getElementById('secureLoginUserSelectionPopup');
				if (popup && typeof popup.openPopup == 'function' && !masterPasswordRequired) {
					try {
						if (this.needsRealLoginObjects()) {
							// On Firefox 3 we still have to get the valid login objects:
							this.secureLogins = this.getRealLoginObjects();

							// Return if the list of login objects is empty (should not happen):
							if (!this.secureLogins || this.secureLogins.length == 0) {
								return;
							}
						}
						this.prepareUserSelectionPopup(popup);
						// Show the popup menu (only available for Firefox >= 3):
						popup.openPopup(aEvent.target, null, 0, 0, false, true);
					} catch (e) {
						this.log(e);
						// Decrypting failed
						return;
					}
				} else {
					// Show a selection box instead of the popup menu:
					this.login(null, null, true);
				}
			} else {
				// Just login with the single available username:
				this.login(null, 0, true);
			}
		} else {
			// Autofill Forms integration (requires extension autofillForms@blueimp.net):
			if (this.secureLoginPrefs.getBoolPref('autofillFormsOnLogin')) {
				try {
					autofillForms.fillForms();
				} catch(e) {
					this.log(e);
				}
			}
		}
	},

	login: function(aWin, aLoginIndex, aSkipLoginSearch) {
		if (!aWin || !aWin.document) {
			aWin = this.getWin();
		}

		// Autofill Forms integration (requires extension autofillForms@blueimp.net):
		if (this.secureLoginPrefs.getBoolPref('autofillFormsOnLogin')) {
			try {
				autofillForms.fillForms(aWin);
			} catch (e) {
				this.log(e);
			}
		}

		// Search for valid logins and outline login fields if not done automatically:
		if (!this.secureLoginPrefs.getBoolPref('searchLoginsOnload') && !aSkipLoginSearch) {
			this.searchLoginsInitialize(aWin);
		}

		// Check for valid logins:
		if (this.secureLogins && this.secureLogins.length > 0) {
			try {
				if (this.needsRealLoginObjects()) {
					// On Firefox 3 we still have to get the valid login objects:
					this.secureLogins = this.getRealLoginObjects();

					// Return if the list of login objects is empty (user canceled master password entry):
					if (!this.secureLogins || this.secureLogins.length == 0) {
						return;
					}
				}

				// The list index of the login:
				var selectedIndex = 0;

				// Prompt for a selection, if list contains more than one login:
				if (this.secureLogins.length > 1) {
					// Check if the loginIndex contains an index to select:
					if (typeof aLoginIndex != 'undefined' && !isNaN(parseInt(aLoginIndex)) && aLoginIndex < this.secureLogins.length) {
						selectedIndex = aLoginIndex;
					}
					else {
						var list = new Array(this.secureLogins.length);
						for (var i = 0; i < this.secureLogins.length; i++) {
							list[i] = this.getUsernameFromLoginObject(this.secureLogins[i]);
							// Show form index?
							if (this.showFormIndex) {
								list[i] += '  (' + this.secureLoginsFormIndex[i] + ')';
							}
						}
						var selected = {};

						var selectionPrompt = this.getStringBundle().getString('loginSelectionPrompt');
						if (this.showFormIndex) {
							selectionPrompt += '  (' + this.getStringBundle().getString('formIndex') + ')';
						}

						var ok = this.getPrompts().select(
							window,
							this.getStringBundle().getString('loginSelectionWindowTitle'),
							selectionPrompt + ':',
							list.length,
							list,
							selected
						);
						
						if (!ok) {
							return;
						}

						// Set the list index to the selected one:
						selectedIndex = selected.value
					}
				}

				// Set the win object to the window (frame) containing the login form:
				aWin = this.secureLoginsWindow[selectedIndex];

				// Return if the window has been closed in the meantime:
				if (aWin.closed) {
					return;
				}

				// The document containing the form:
				var doc = this.getDoc(aWin);

				// The index for the form containing the login fields:
				var formIndex = this.secureLoginsFormIndex[selectedIndex];

				// The login form:
				var form = doc.forms[formIndex];

				// The form elements list:
				var elements = form.elements;

				// User + Pass fields:
				var usernameField = this.secureLoginsUserField[selectedIndex];
				var passwordField = this.secureLoginsPassField[selectedIndex];	

				// The charset of the given document:
				var charset = doc.characterSet;

				// Get the target url from the form action value or if empty from the current document:
				var url = form.action ? form.action : doc.baseURI;

				// Ask for confirmation if we had a failed bookmark-login:
				if (this.failedBookmarkLogin) {
					var continueLogin = this.getPrompts().confirm(
						null,
						this.getStringBundle().getString('loginConfirmTitle'),
						this.getStringBundle().getString('loginConfirmURL') + ' ' + url
					);
					if (!continueLogin) {
						return;
					}
				}

				// Reset failed bookmark-login:
				this.failedBookmarkLogin = null;
				
				// If JavaScript protection is to be used, check the exception list:
				var useJavaScriptProtection = this.secureLoginPrefs.getBoolPref('javascriptProtection');
				if (useJavaScriptProtection && this.inArray(this.getExceptions(), doc.location.protocol + '//' + doc.location.host)) {
					useJavaScriptProtection = false;
				}

				// Send login data without using the form:
				if (useJavaScriptProtection) {

					// String to save the form data:
					var dataString = '';
					
					// Reference to the main secureLogin object:
					var parentObject = this;
					
					// Local helper function to add name and value pairs urlEncoded to the dataString:
					function addToDataString(aName, aValue) {
						if (dataString) {
							dataString += '&';
						}
						dataString += parentObject.urlEncode(aName, charset)
									+ '='
									+ parentObject.urlEncode(aValue, charset);
					}

					var submitButtonFound = false;

					// Search for form elements other than user+pass fields and add them to the dataString:
					for (var i = 0; i < elements.length; i++) {

						// Don't add disabled elements or elements without a "name":
						if (!elements[i].name || elements[i].disabled) {
							continue;
						}

						switch (elements[i].type) {
							case 'text':
								if (!usernameField || elements[i].name != usernameField.name) {
									addToDataString(elements[i].name, elements[i].value);
								} else {
									// This is the userName field - use the saved username as value:
									addToDataString(
										usernameField.name,
										this.getUsernameFromLoginObject(this.secureLogins[selectedIndex])
									);
								}
								break;
							case 'password':
								// This is the password field - use the saved password as value:
								addToDataString(
									passwordField.name,
									this.getPasswordFromLoginObject(this.secureLogins[selectedIndex])
								);
								break;
							case 'hidden':
							case 'select-one':
							case 'textarea':
								addToDataString(elements[i].name, elements[i].value);
								break;
							case 'select-multiple':
								for (var j = 0; j < elements[i].options.length; j++) {
									if (elements[i].options[j].selected) {
										addToDataString(elements[i].name, elements[i].options[j].value);
									}
								}
								break;
							case 'checkbox':
							case 'radio':
								if (elements[i].checked) {
		    						addToDataString(elements[i].name, elements[i].value);
								}
								break;
							case 'submit':
								// Only add first submit button:
								if (!submitButtonFound) {
									addToDataString(elements[i].name, elements[i].value);
									submitButtonFound = true;
								}
								break;
						}

					}

					// If no submit button found, search for an input of type="image" which ist not in the elements list:
					if (!submitButtonFound) {
						var inputElements = form.getElementsByTagName('input');
						for (var i = 0; i < inputElements.length; i++) {
							if(inputElements[i].type == 'image') {
								// Image submit buttons add the "click-coordinates" name.x and name.y to the request data:
								addToDataString(inputElements[i].name + '.x', 1);
								addToDataString(inputElements[i].name + '.y', 1);
								addToDataString(inputElements[i].name, inputElements[i].value);
							}
						}
					}

					// Check if the url is an allowed one (throws an exception if not):
					this.urlSecurityCheck(url, doc.location.href);

					// Send the data by GET or POST:
					if (form.method && form.method.toLowerCase() == 'get') {
						// Add the parameter list to the url, remove existing parameters:
						var paramIndex = url.indexOf('?');
						if(paramIndex == -1) {
							url += '?' + dataString;
						}
						else {
							url = url.substring(0, paramIndex+1) + dataString;
						}
						// Load the url in the current window (params are url, referrer and post data):
						loadURI(url, this.makeURI(doc.location.href, charset), null);
					}
					else {
						// Create post data mime stream (params are aStringData, aKeyword, aEncKeyword, aType):
						var postData = getPostDataStream(dataString, '', '', 'application/x-www-form-urlencoded');
						// Load the url in the current window (params are url, referrer and post data):
						loadURI(url, this.makeURI(doc.location.href, charset), postData);
					}

				} else {
					// Fill the login fields:
					if (usernameField) {
						usernameField.value = this.getUsernameFromLoginObject(this.secureLogins[selectedIndex]);
					}
					passwordField.value = this.getPasswordFromLoginObject(this.secureLogins[selectedIndex]);

					if (this.secureLoginPrefs.getBoolPref('autoSubmitForm')) {
						// Prevent multiple submits (e.g. if submit is delayed) by setting a variable (after click on a submit button):
						var submitted = false;
						// Search for the submit button:
						for (var i = 0; i < elements.length; i++) {
							// auto-login by clicking on the submit button:
							if (elements[i].type && elements[i].type == 'submit') {
								elements[i].click();
								submitted = true;
								break;
							}
						}

						if (!submitted) {
							// Search for a submit button of type="image" which ist not in the elements list:
							var inputElements = doc.getElementsByTagName('input');
							for (var i = 0; i < inputElements.length; i++) {
								// auto-login by clicking on the image submit button if it belongs to the current form:
								if (inputElements[i].type == 'image' && inputElements[i].form && inputElements[i].form == form) {
									inputElements[i].click();
									submitted = true;
									break;
								}
							}

							if (!submitted) {
								// No submit button found, try to submit anyway:
								form.submit();
							}
						}
					} else {
						// Don't submit automatically but set the focus on the password field,
						// this way submitting can be done by hitting return on the keyboard:
						passwordField.focus();
						return;
					}
				}

				// Play sound notification:
				if (this.secureLoginPrefs.getBoolPref('playLoginSound')) {
					this.playSound('loginSoundFileName');
				}

			}
			catch (e) {
				// Decrypting failed or url is not allowed
				this.log(e);
				return;
			}
		}

		// Reset secure login objects to release memory:
		this.secureLogins = null;
		this.secureLoginsFormIndex = null;
		this.secureLoginsPassField = null;
		this.secureLoginsUserField = null;
		this.secureLoginsWindow = null;
	},

	getUsernameFromLoginObject: function (aLoginObject) {
		return aLoginObject.username;
	},

	getPasswordFromLoginObject: function (aLoginObject) {
		// Both login objects (Firefox 3 and before) contain a "password" attribute:
		return aLoginObject.password;
	},

	getExceptions: function () {
		// Get the exception list from the preferences:
		var exceptions = this.secureLoginPrefs
							.getComplexValue('exceptionList',Components.interfaces.nsISupportsString)
							.data.split(' ');
		return exceptions && exceptions[0] ? exceptions : new Array();
	},

	shortcutFactory: function (aModifiers, aKey, aKeycode) {
		if (typeof arguments.callee.shortcut == 'undefined') {
			arguments.callee.shortcut = function (aModifiers, aKey, aKeycode) {
				this.modifiers = aModifiers ? aModifiers : new Array();
				this.key = aKey;
				this.keycode = aKeycode;
				this.toString = function() {
					if(this.modifiers.length) {
						return this.modifiers.join('+')+'+'+this.key+this.keycode;
					} else {
						return this.key+this.keycode;
					}
				}
				this.equals = function(shortcut) {
					if (this.key != shortcut.key) {
						return false;
					}
					if (this.keycode != shortcut.keycode) {
						return false;
					}
					if (this.modifiers.length != shortcut.modifiers.length) {
						return false;
					}
					for (var i=0; i<this.modifiers.length; i++) {
						if(this.modifiers[i] != shortcut.modifiers[i]) {
							return false;
						}
					}
					return true;
				}
				return this;
			}
		}
		return new arguments.callee.shortcut(aModifiers, aKey, aKeycode);
	},

	getShortcut: function () {
		if (this.shortcut == null) {
			var key = null;
			var keycode = null;
			var shortcutItems = this.secureLoginPrefs
								.getComplexValue('shortcut',Components.interfaces.nsIPrefLocalizedString)
								.data.split('+');
			if (shortcutItems.length > 0) {
				// Remove the last element and save it as key
				// the remaining shortcutItems are the modifiers:
				key = shortcutItems.pop();
				// Check if the key is a keycode:
				if (key.indexOf('VK') == 0) {
					keycode	= key;
					key = null;
				}
			}			
			// Create a new shortcut object:
			this.shortcut = this.shortcutFactory(shortcutItems, key, keycode);
		}
		return this.shortcut;
	},

	updateShortcut: function () {
		// Setting the shortcut object to "null" will update it on the next getShortcut() call:
		this.shortcut = null;
		// Get the keyboard shortcut elements:
		var modifiers = this.getShortcut()['modifiers'].join(' ');
		var key = this.getShortcut()['key'];
		var keycode = this.getShortcut()['keycode'];

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

	getFormattedShortcut: function (aShortcutParam) {
		// Get shortcut from param or take the object attribute:
		var shortcut = aShortcutParam ? aShortcutParam : this.getShortcut();
		var formattedShortcut = '';
		// Add the modifiers:
		for (var i = 0; i < shortcut['modifiers'].length; i++)
			try {
				formattedShortcut += this.getStringBundle().getString(shortcut['modifiers'][i]) + '+';
			} catch (e) {
				this.log(e);
				// Error in shortcut string, return empty String;
				return '';
			}
		if (shortcut['key'])
			// Add the key:
			if (shortcut['key'] == ' ') {
				formattedShortcut += this.getStringBundle().getString('VK_SPACE');
			}
			else {
				formattedShortcut += shortcut['key'];
			}
		else if (shortcut['keycode']) {
			// Add the keycode (instead of the key):
			try {
				formattedShortcut += this.getStringBundle().getString(shortcut['keycode']);
			} catch (e) {
				// If no localization is available just use the plain keycode:
				formattedShortcut += shortcut['keycode'].replace('VK_', '');
			}
		}
		return formattedShortcut;
	},

	playSound: function(aPrefName) {
		try {
			// Get the filename stored in the preferences:
			var file = this.secureLoginPrefs.getComplexValue(aPrefName, Components.interfaces.nsILocalFile);

			// Get an url for the file:
			var url = this.getIOS().newFileURI(file, null, null);

			// Play the sound:
			this.getSound().play(url);
		} catch (e) {
			this.log(e);
			// No file found
		}
	},

	showDialog: function (aUrl, aParams) {
		var paramObject = aParams ? aParams : this;
		return window.openDialog(
			aUrl,
			'',
			'chrome=yes,resizable=yes,toolbar=yes,centerscreen=yes,modal=no,dependent=no,dialog=no',
			paramObject
		);
	},

	showPasswordManager: function () {
		var params = new Object();
		try {
			// Filter the passwords list with the current host as filterString:
			params.filterString = this.getDoc().location.host;
		} catch (e) {
			// Invalid location.host, e.g. about:config
		}
		this.showDialog(
			'chrome://passwordmgr/content/passwordManager.xul',
			params
		);
	},

	showBookmarkDialog: function () {
		var doc = this.getDoc();
		if (doc && doc.forms && doc.forms.length > 0 && doc.location) {
			var url;
			// Create a Secure Login Bookmark out of the current URL:
			if (doc.location.hash) {
				var regExp = new RegExp(doc.location.hash + '$');
				url = doc.location.href.replace(regExp, this.secureLoginPrefs.getCharPref('secureLoginBookmarkHash'));
			} else {
				url = doc.location.href + this.secureLoginPrefs.getCharPref('secureLoginBookmarkHash');
			}

			var bookmarkArguments = {
				action: 'add',
				type: 'bookmark',
				hiddenRows: ['location', 'description', 'load in sidebar'],
				uri: this.makeURI(url, doc.characterSet),
				title: doc.title
			};
			window.openDialog(
				'chrome://browser/content/places/bookmarkProperties2.xul',
				'', 
				'centerscreen=yes,chrome=yes,dialog=yes,resizable=yes,dependent=yes',
				bookmarkArguments
			);
		}
	},

	urlSecurityCheck: function (aUrl, aSourceURL) {
		try {
			this.getSecManager().checkLoadURIStr(aSourceURL, aUrl, Components.interfaces.nsIScriptSecurityManager.STANDARD);
		} catch (e) {
			throw 'Loading of ' + url + ' denied.';
		}
	},

	makeURI: function (aURL, aOriginCharset) {
		return this.getIOS().newURI(aURL, aOriginCharset, null);
	},

	urlEncode: function (aString, aCharset) {
		if(aCharset == 'UTF-8') {
			// encodeURIComponent encodes the strings by using escape sequences
			// representing the UTF-8 encoding of the character:
			return encodeURIComponent(aString);
		} else {
			// This escapes characters representing the given charset,
			// it won't work if the given string is not part of the charset
			return this.getTextToSubURI().ConvertAndEscape(aCharset, aString);
		}
	},

	getTextToSubURI: function () {
		return Components.classes['@mozilla.org/intl/texttosuburi;1']
				.getService(Components.interfaces.nsITextToSubURI);
	},

	getUnicodeString: function (aStringData) {
		// Create an Unicode String:
		var str = Components.classes['@mozilla.org/supports-string;1']
					.createInstance(Components.interfaces.nsISupportsString);
		// Set the String value:
		str.data = aStringData;
		// Return the Unicode String:
		return str;
	},

	getStringBundle: function () {
		return document.getElementById('secureLoginStringBundle');
	},

	getDoc: function(aWin) {
		if (aWin) {
			return aWin.document;
		}
		else if (content) {
			return content.document;
		}
		else {
			return this.getBrowser().contentDocument;
		}
	},

	getWin: function () {
		if (content) {
			return content;
		}
		else {
			return this.getBrowser().contentWindow;
		}
	},

	getBrowser: function () {
		try {
			return gBrowser;
		} catch(e) {
			// gBrowser is not available, so make use of the WindowMediator service instead:
			return this.getWindowMediator().getMostRecentWindow('navigator:browser').getBrowser();
		}
	},

	_getWindowMediator: null,
	getWindowMediator: function () {
		if (!this._getWindowMediator) {
			this._getWindowMediator = Components.classes['@mozilla.org/appshell/window-mediator;1']
			                          .getService(Components.interfaces.nsIWindowMediator);
		}
		return this._getWindowMediator;
	},

	_getLoginManager: null,
	getLoginManager: function () {
		if (!this._getLoginManager) {
			this._getLoginManager = Components.classes['@mozilla.org/login-manager;1']
			                        .getService(Components.interfaces.nsILoginManager);
		}
		return this._getLoginManager;
	},

	_getPrefManager: null,
	getPrefManager: function () {
		if (!this._getPrefManager) {
			this._getPrefManager = Components.classes['@mozilla.org/preferences-service;1']
			                       .getService(Components.interfaces.nsIPrefService);
		}
		return this._getPrefManager;
	},

	_getSecManager: null,
	getSecManager: function () {
		if (!this._getSecManager) {
			this._getSecManager = Components.classes['@mozilla.org/scriptsecuritymanager;1']
			                      .getService(Components.interfaces.nsIScriptSecurityManager);
		}
		return this._getSecManager;
	},

	_getIOS: null,
	getIOS: function () {
		if (!this._getIOS) {
			this._getIOS = Components.classes['@mozilla.org/network/io-service;1']
			               .getService(Components.interfaces.nsIIOService);
		}
		return this._getIOS;
	},

	getFileHandler: function () {
		return this.getIOS().getProtocolHandler('file')
		       .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
	},

	getSound: function () {
		return Components.classes['@mozilla.org/sound;1']
		       .createInstance(Components.interfaces.nsISound);
	},

	_getPrompts: null,
	getPrompts: function () {
		if (!this._getPrompts) {
			this._getPrompts = Components.classes['@mozilla.org/embedcomp/prompt-service;1']
			                   .getService(Components.interfaces.nsIPromptService);
		}
		return this._getPrompts;
	},

	_getAppInfo: null,
	getAppInfo: function () {
		if (!this._getAppInfo) {
			this._getAppInfo = Components.classes['@mozilla.org/xre/app-info;1']
			                   .getService(Components.interfaces.nsIXULAppInfo);
		}
		return this._getAppInfo;
	},

	_getVersionComparator: null,
	getVersionComparator: function () {
		if (!this._getPrompts) {
			this._getPrompts = Components.classes['@mozilla.org/xpcom/version-comparator;1']
			                   .getService(Components.interfaces.nsIVersionComparator);
		}
		return this._getPrompts;
	},

	inArray: function (aArray, aItem) {
		var i = aArray.length;
		while (i--) {
			if (aArray[i] === aItem) {
				return true;
			}
		}
		return false;
	},

	openHelp: function (aTopic) {
		if(!aTopic) {
			aTopic = '';
		}
		var url = this.secureLoginPrefs.getCharPref('helpURL').replace(/\[TOPIC\]$/, aTopic);
		this.openNewTab(url, true);
	},

	openNewTab: function (aUrl, aFocus) {
		var helpTab = this.getBrowser().addTab(aUrl);
		if(aFocus) {
			this.getBrowser().selectedTab = helpTab;
			this.getWindowMediator().getMostRecentWindow('navigator:browser').focus();
		}
	},

	get consoleSvc () {
		delete this.consoleSvc;
		return this.consoleSvc = Components.classes['@mozilla.org/consoleservice;1']
		                         .getService(Components.interfaces.nsIConsoleService);
	},
	log: function (aMessage, aSourceName, aSourceLine, aLineNumber, aColumnNumber, aFlags, aCategory) {
		var consoleService = this.consoleSvc;
		if (aSourceName != 'undefined') {
			var scriptError = Components.classes["@mozilla.org/scripterror;1"]
				.createInstance(Components.interfaces.nsIScriptError);
			scriptError.init(
				aMessage,
				aSourceName,
				aSourceLine,
				aLineNumber,
				aColumnNumber,
				aFlags,
				aCategory
			);
			consoleService.logMessage(scriptError);
		} else {
			consoleService.logStringMessage(aMessage);
		}
	},

	finalizeToolbarButtonStatus: function () {
		var secureLoginButton = document.getElementById('secureLoginButton');
		var hideToolbarButton = this.secureLoginPrefs.getBoolPref('hideToolbarButton');
		if(!secureLoginButton && !hideToolbarButton) {
			// If the toolbar button icon has been removed from the toolbar by drag&drop
			// enable the hideToolbarButton setting:
			this.secureLoginPrefs.setBoolPref('hideToolbarButton', true);
		} else if(secureLoginButton && !secureLoginButton.getAttribute('hidden')) {
			// If the toolbar button icon has been added to the toolbar by drag&drop
			// disable the hideToolbarButton setting:
			this.secureLoginPrefs.setBoolPref('hideToolbarButton', false);
		}
	},

	finalizeSignonAutofillFormsStatus: function () {
		// Re-enable the prefilling of login forms if setting has been true:
		try {
			if(this.autofillForms) {
				this.getPrefManager().getBranch('').setBoolPref('signon.autofillForms', true);
			}
		} catch(e) {
			this.log(e);
		}
	},

	finalize: function () {
		this.finalizeToolbarButtonStatus();
		this.finalizeSignonAutofillFormsStatus();

		// Remove the content area context menu listener:
		var contentAreaContextMenu = document.getElementById('contentAreaContextMenu');
		if(contentAreaContextMenu) {
			contentAreaContextMenu.removeEventListener(
				'popupshowing',
				this.contentAreaContextMenuEventListener,
				false
			);
		}

		// Remove the listener from the browser object:
		try {
			this.getBrowser().removeProgressListener(this.progressListener);
		} catch(e) {
			this.log(e);
		}

		// Remove the preferences Observer:
		this.secureLoginPrefs.removeObserver('', this);
	}

};