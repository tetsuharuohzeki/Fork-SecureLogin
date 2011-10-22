/*
 * @package secureLogin
 * @author Sebastian Tschan
 * @copyright (c) Sebastian Tschan
 * @license GNU General Public License
 * @link https://blueimp.net/mozilla/
 */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
var SecureLogin = {

	obsTopic: "securelogin",

	// Secure Logins preferences branch:
	get prefs () {
		delete this.prefs;
		return this.prefs = Services.prefs.getBranch('extensions.secureLogin@blueimp.net.')
		                    .QueryInterface(Components.interfaces.nsIPrefBranch2);
	},

	// The progress listener:
	get progressListener () {
		delete this.progressListener;
		let self = this;
		// Implement the listener methods:
		this.progressListener = {
			QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIWebProgressListener,
			                                       Components.interfaces.nsISupportsWeakReference,
			                                       Components.interfaces.nsISupports]),
			onStateChange: function (aProgress, aRequest, aFlag, aStatus) {
				// Update status when load finishes:
				if (aFlag & Components.interfaces.nsIWebProgressListener.STATE_STOP) {
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

	updateStatus: function (aProgress, aRequest, aLocation, aFlag, aStatus) {
		if (this.searchLoginsOnload) {
			// Initialize the recursive search for logins on the current window:
			this.initializeSearchLogins(aProgress.DOMWindow, true);
		}
	},

	// Variable to define if the progress listener has been registered to the browser:
	isProgressListenerRegistered: null,
	// Helper var to remember original autofillForms setting (this has nothing to to with the extension autofillForms@blueimp.net:
	modify_signon_autofillForms: null,

	// Valid logins list:
	_secureLogins: null,
	get secureLogins () {
		if ( !(this._secureLogins instanceof Array) ) {
			this._secureLogins = [];
		}
		return this._secureLogins;
	},
	set secureLogins (aValue) {
		if ( !(aValue instanceof Array) ) {
			aValue = [];
		}
		this._secureLogins = aValue;
	},

	// Defines if form index is to be shown in selection prompt:
	showFormIndex: null,
	// Object containing the shortcut information (modifiers, key or keycode):
	shortcut: null,
	// cache css text for highlight form:
	hightlightOutlineStyle: null,
	highlightOutlineRadius: null,

	JSPExceptionsList: null,

	// Variable to define if searching login form on load.
	searchLoginsOnload: null,
	skipDuplicateActionForms: null,

	// cache to preferences about doorhanger notification:
	showDoorhangerLogin: null,
	showDoorhangerLoginDismissed: null,

	observe: function (aSubject, aTopic, aData) {
		// Only observe preferences changes:
		if (aTopic != 'nsPref:changed') {
			return;
		}
		switch (aData) {
			case 'searchLoginsOnload':
				this.updateSearchLoginsOnload();
				break;
			case 'highlightColor':
			case "highlightOutlineWidth":
			case "highlightOutlineStyle":
			case "highlightOutlineRadius":
				this.updateHighlightStyle();
				break;
			case "exceptionList":
				this.updateJSPExceptionsList();
				break;
			case "showDoorhangerLogin":
			case "showDoorhangerLogin.dismissed":
				this.updateShowDoorhanger();
				break
			case "skipDuplicateActionForms":
				this.skipDuplicateActionForms = this.prefs.getBoolPref(aData);
				break;
		}
	},

	initialize: function () {
		// Add a preferences observer to the secureLogin preferences branch:
		this.prefs.addObserver('', this, false);

		// Initialize the preferences settings:
		this.initializePrefs();
	},

	initializePrefs: function () {
		this.initializeSignonAutofillFormsStatus();

		this.updateHighlightStyle();

		// cache preferences about doorhanger notification:
		this.updateShowDoorhanger();

		// check & cache whether searching login skips duplicate action forms:
		this.skipDuplicateActionForms = this.prefs.getBoolPref("skipDuplicateActionForms");

		// Add the progress listener to the browser, set the Secure Login icons:
		this.updateSearchLoginsOnload();
	},

	initializeSignonAutofillFormsStatus: function () {
		// Disable the prefilling of login forms if enabled, remember status:
		try {
			let rootPrefBranch = Services.prefs.getBranch('');
			if (rootPrefBranch.getBoolPref('signon.autofillForms')) {
				rootPrefBranch.setBoolPref('signon.autofillForms', false);
				this.modify_signon_autofillForms = true;
			}
			else {
				this.modify_signon_autofillForms = false;
			}
		}
		catch (e) {
			Components.utils.reportError(e);
		}
	},

	updateSearchLoginsOnload: function () {
		let isSearchLoginsOnload = this.prefs.getBoolPref("searchLoginsOnload");

		// set internal variable:
		this.searchLoginsOnload = isSearchLoginsOnload;

		this.updateProgressListener(isSearchLoginsOnload);

		if (isSearchLoginsOnload) {
			// Search for valid logins and outline login fields:
			this.initializeSearchLogins(null, true);
		}
		else {
			// Always highlight the Secure Login icons, when not searching for valid logins automatically:
			this.notifyUpdateLoginButton(true);
		}
	},

	updateProgressListener: function (aIsSearchLoginsOnload) {
		if (!aIsSearchLoginsOnload) {
			// Remove the listener from the browser object (if added previously):
			try {
				gBrowser.removeProgressListener(this.progressListener);
				this.isProgressListenerRegistered = false;
			} catch (e) {
				Components.utils.reportError(e);
			}
		}
		else if (!this.isProgressListenerRegistered && aIsSearchLoginsOnload) {
			// Add the progress listener to the browser object (if not added previously):
			try {
				gBrowser.addProgressListener(this.progressListener);
				this.isProgressListenerRegistered = true;
			}
			catch (e) {
				Components.utils.reportError(e);
			}
		}
	},

	notifyUpdateLoginButton: function (aIsBtnEnable) {
		let btnStatus = aIsBtnEnable ? "enableLoginButton" : "disableLoginButton";
		this._notifyUpdateLoginIcon(btnStatus);
	},

	notifyShowDoorHangerLogin: function () {
		if (this.showDoorhangerLogin) {
			this._notifyUpdateLoginIcon("showDoorhangerLogin");
		}
	},

	_notifyUpdateLoginIcon: function (aData) {
		let subject   = { wrappedJSObject: window };
		Services.obs.notifyObservers(subject, this.obsTopic, aData);
	},

	updateShowDoorhanger: function () {
		let pref = this.prefs;
		this.showDoorhangerLogin = pref.getBoolPref("showDoorhangerLogin");
		this.showDoorhangerLoginDismissed = pref.getBoolPref("showDoorhangerLogin.dismissed");
	},

	updateHighlightStyle: function () {
		let getCharPref = this.prefs.getCharPref;
		//create outline-style string:
		let outlineStyle = getCharPref("highlightOutlineWidth") + //outline-width
		                   " " +
		                   getCharPref("highlightOutlineStyle") + //outline-style
		                   " " +
		                   getCharPref("highlightColor"); //outline-color
		this.highlightOutlineStyle = outlineStyle;
		this.highlightOutlineRadius = getCharPref("highlightOutlineRadius");

		let secureLogins = this.secureLogins;
		if (secureLogins.length > 0) {
			// Update the outlined form fields:
			for (let i = 0, l = secureLogins.length; i < l; ++i) {
				let userField = secureLogins[i].usernameField;
				let passField = secureLogins[i].passwordField;
				// Outline the username field if existing:
				if (userField) {
					this.highlightElement(userField);
				}
				// Outline the password field if existing:
				if (passField) {
					this.highlightElement(passField);
				}
			}
		}
	},

	initializeSearchLogins: function (aWin, aUpdateStatus) {
		if (!aWin) {
			aWin = this.getContentWindow();
		}

		if (!aWin.frameElement) {
			// Reset the found logins and helper lists:
			this.secureLogins = null;

			// Show form index only if more than one valid login form is found:
			this.showFormIndex = false;

			// Search for valid logins on the given window:
			this.searchLogins(aWin);
		}

		if (aUpdateStatus) {
			this.updateLoginsFoundStatus();
		}
	},

	updateLoginsFoundStatus: function () {
		if (this.secureLogins.length > 0) {
			this.notifyUpdateLoginButton(true);
			this.notifyShowDoorHangerLogin();
		}
		else {
			this.notifyUpdateLoginButton(false);
		}
	},

	searchLogins: function (aWin) {
		let document = this.getContentDocument(aWin);
		let forms = document.forms;
		let location = document.location;

		// Check if any web forms are available on the current window:
		if (document && location && forms && (forms.length > 0)) {
			// document (current) host:
			let host = location.protocol + '//' + location.host;

			// Getting the number of existing logins with countLogins()
			// instead of findLogins() to avoid a Master Password prompt:
			let loginsCount = Services.logins.countLogins(host, "", null);
			if (loginsCount > 0) {
				let formURIs = new Array();
				let isSkipDuplicateActionForms = this.skipDuplicateActionForms;

 				// Go through the forms:
 				for (let i = 0, l = forms.length; i < l; ++i) {
					// Check to finish searching logins in this document:
					if (loginsCount <= 0) {
						break;
					}

 					let form = forms[i];

					// Forms with no "action" attribute default to submitting to their origin URL:
					let formAction = form.action ? form.action : document.baseURI;

					// Create a nsIURI object from the formAction:
					let formURI = this.makeURI(formAction, document.characterSet, document.baseURI);
					let targetHost = formURI.prePath;

					if (isSkipDuplicateActionForms) {
						// Skip this form if the same formURI has already been added:
						let isDuplicate = formURIs.some(function(aNsIURI){
							return aNsIURI.equals(formURI);
						});

						if (isDuplicate) {
							continue;
						}
					}

					let loginInfos = Services.logins.findLogins({}, host, targetHost, null);
					let isFoundLogin = false;
					// Go through the logins:
					for (let j = 0, k = loginInfos.length; j < k; ++j) {
						isFoundLogin = this._findLoginField(loginInfos[j], form, i, aWin, formURI);
						if (isFoundLogin) {
							loginsCount--;
						}
					}
					if (isFoundLogin && isSkipDuplicateActionForms) {
						// Add the formURI to the list:
						formURIs.push(formURI);
					}
				}
			}
		}
	},

	_findLoginField: function (aLoginInfo, aForm, aFormIndex, aWindow, aFormURI) {
		let isFoundLogin = false;

		// Get valid login fields:
		let loginFields = this.getLoginFields(aForm, aLoginInfo.usernameField, aLoginInfo.passwordField);

		if (loginFields) {
			let user = loginFields.usernameField;
			let pass = loginFields.passwordField;

			let foundLogin = {
				loginInfo    : aLoginInfo,
				formIndex    : aFormIndex,
				window       : aWindow,
				usernameField: user,
				passwordField: pass,
				actionURI    : aFormURI.spec,
			};
			this.addToFoundLoginsList(foundLogin);

			// highlight login fields:
			this.highlightLoginFields(user, pass);

			isFoundLogin = true;
		}

		return isFoundLogin;
	},

	getLoginFields: function (aForm, aLoginUsernameFieldName, aLoginPasswordFieldName) {
		let loginFields = null;

		// The form fields for user+pass:
		let usernameField = null;
		let passwordField = null;

		// helper var to define if the login form is a password only form:
		let isOnlyPassField = true;

		// The form elements list:
		let elements = aForm.elements;

		let userInput = elements[aLoginUsernameFieldName];
		if (userInput) {
			isOnlyPassField = false;
			usernameField = userInput;
		}

		let passInput = elements[aLoginPasswordFieldName];
		if (passInput && passInput.type == "password") {
			passwordField = passInput;
		}

		if (passwordField) {
			// If there is username field, or
			// there is no input which type is not "password" and also userFieldName is empty:
			if (usernameField || (isOnlyPassField && !aLoginUsernameFieldName)) {
				loginFields = {
					usernameField: usernameField,
					passwordField: passwordField,
				};
			}
		}
		return loginFields;
	},

	addToFoundLoginsList: function (aFoundLogin) {
		let secureLogins = this.secureLogins;

		// Test if there is only one valid login form:
		let isInArray = secureLogins.some(function(aElm){
			return (aElm.formIndex === aFoundLogin.formIndex);
		});
		if (!this.showFormIndex && (secureLogins.length > 0) && !isInArray) {
			this.showFormIndex = true;
		}

		// Save the login in the valid logins list:
		secureLogins.push(aFoundLogin);
	},

	highlightLoginFields: function (aUsernameField, aPasswordField) {
		if (aUsernameField) {
			this.highlightElement(aUsernameField);
		}

		if (aPasswordField) {
			this.highlightElement(aPasswordField);
		}
	},

	highlightElement: function (aElement) {
		let style = aElement.style;
		style.outline          = this.highlightOutlineStyle;
		style.outlineRadius    = this.highlightOutlineRadius;
		style.MozOutlineRadius = this.highlightOutlineRadius;
	},

	login: function(aWin, aLoginIndex, aSkipLoginSearch) {
		if (!aWin || !aWin.document) {
			aWin = this.getContentWindow();
		}

		// Search for valid logins and outline login fields if not done automatically:
		let isSearchLoginsOnload = this.searchLoginsOnload;
		if (!isSearchLoginsOnload && !aSkipLoginSearch) {
			this.initializeSearchLogins(aWin, false);
		}

		// Check for valid logins:
		let secureLogins = this.secureLogins;
		if (secureLogins.length > 0) {
			try {
				// The list index of the login:
				let selectedIndex = (secureLogins.length > 1) ?
				                    this._selectLoginAccount(aLoginIndex) : 0;

				// Cache login data:
				let secureLoginData = secureLogins[selectedIndex];

				// Set the win object to the window (frame) containing the login form:
				let window = secureLoginData.window;

				// Return if the window has been closed in the meantime:
				if (window.closed) {
					return;
				}

				// The document containing the form:
				let document = this.getContentDocument(window);
				let location = document.location;

				// The index for the form containing the login fields:
				let formIndex = secureLoginData.formIndex;

				// The login form:
				let form = document.forms[formIndex];

				// The charset of the given document:
				let charset = document.characterSet;

				// Get the target url from the form action value or if empty from the current document:
				let actionURI = secureLoginData.actionURI;

				// If JavaScript protection is to be used, check the exception list:
				let useJavaScriptProtection = this._useJavaScriptProtection(location);

				let loginInfos = {
					location       : location,
					form           : form,
					actionURI      : actionURI,
					charset        : charset,
				};

				// Send login data without using the form:
				if (useJavaScriptProtection) {
					this._loginWithJSProtection(secureLoginData, loginInfos);
				}
				else {
					this._loginWithNormal(secureLoginData, loginInfos);
				}
			}
			catch (e) {
				// Decrypting failed or url is not allowed
				Components.utils.reportError(e);
				return;
			}
		}

		// Reset secure login objects to release memory:
		this.secureLogins = null;
	},

	_selectLoginAccount: function (aLoginIndex) {
		let selectedIndex;
		let secureLogins = this.secureLogins;
		// Check if the loginIndex contains an index to select:
		if ( (typeof aLoginIndex != "undefined") &&
		     (!isNaN(parseInt(aLoginIndex)))     &&
		     (aLoginIndex < secureLogins.length) ) {
			selectedIndex = aLoginIndex;
		}
		else {
			let GetStringFromName = this.stringBundle.GetStringFromName;

			let selectionPrompt = GetStringFromName("loginSelectionPrompt");
			if (this.showFormIndex) {
				selectionPrompt += "  (" + GetStringFromName("formIndex") + ")";
			}

			let list = new Array(secureLogins.length);
			for (let i = 0; i < secureLogins.length; i++) {
				list[i] = this.getUsernameFromLoginObject(secureLogins[i].loginInfo);
				// Show form index?
				if (this.showFormIndex) {
					list[i] += "  (" + secureLogins[i].formIndex + ")";
				}
			}

			let selected = {};
			let ok = Services.prompt.select(
			    window,
			    GetStringFromName("loginSelectionWindowTitle"),
			    selectionPrompt + ":",
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
		return selectedIndex;
	},

	_useJavaScriptProtection: function (aLocation) {
		let useJavaScriptProtection = this.prefs.getBoolPref("javascriptProtection");
		let jsProtectExceptionArray = this.getJSProtectExceptions();
		let isInException = this.inArray(jsProtectExceptionArray, aLocation.protocol + "//" + aLocation.host);
		return (useJavaScriptProtection && !isInException) ? true : false;
	},

	_loginWithJSProtection: function (aSecureLoginData, aInfoObj) {
		let location        = aInfoObj.location;
		let form            = aInfoObj.form;
		let elements        = form.elements;
		let actionURI       = aInfoObj.actionURI;
		let charset         = aInfoObj.charset;
		let usernameField   = aSecureLoginData.usernameField;
		let passwordField   = aSecureLoginData.passwordField;
		let loginInfo       = aSecureLoginData.loginInfo;

		// String to save the form data:
		let dataString = '';

		// Reference to the main secureLogin object:
		let parentObject = this;

		// Local helper function to add name and value pairs urlEncoded to the dataString:
		function addToDataString(aName, aValue) {
			if (dataString.length !== 0) {
				dataString += '&';
			}
			dataString += (parentObject.urlEncode(aName, charset) + 
			               "=" + 
			               parentObject.urlEncode(aValue, charset));
		}

		let submitButtonFound = false;

		// Search for form elements other than user+pass fields and add them to the dataString:
		for (let i = 0; i < elements.length; i++) {
			let element = elements[i];

			// Don't add disabled elements or elements without a "name":
			if (!element.name || element.disabled) {
				continue;
			}

			switch (element.type) {
				case 'password':
					// This is the password field - use the saved password as value:
					if (passwordField && element.name == passwordField.name) {
						let pass = this.getPasswordFromLoginObject(loginInfo);
						addToDataString(passwordField.name, pass);
					}
					break;
				case 'checkbox':
				case 'radio':
					if (element.checked) {
						addToDataString(element.name, element.value);
					}
					break;
				case 'submit':
					// Only add first submit button:
					// The current implementation of nsILoginInfo does not have
					// identifying data of submit element in login form.
					// So it regards a first submit button as a login button 
					// according to use-case.
					if (!submitButtonFound) {
						addToDataString(element.name, element.value);
						submitButtonFound = true;
					}
					break;
				default:
					if (usernameField && element.name == usernameField.name) {
						// This is the userName field - use the saved username as value:
						let user = this.getUsernameFromLoginObject(loginInfo);
						addToDataString(usernameField.name, user);
					}
					else {
						addToDataString(element.name, element.value);
					}
					break;
			}

		}

		// If no submit button found,
		//search for an input of type="image" which ist not in the elements list:
		if (!submitButtonFound) {
			let inputElements = form.getElementsByTagName('input');
			for (let i = 0; i < inputElements.length; i++) {
				let inputElement = inputElements[i];
				if (inputElement.type == 'image') {
					// Image submit buttons add the "click-coordinates" name.x and name.y
					// to the request data:
					addToDataString(inputElement.name + '.x', 1);
					addToDataString(inputElement.name + '.y', 1);
					addToDataString(inputElement.name, inputElement.value);
				}
			}
		}

		// Check if the actionURI is an allowed one (throws an exception if not):
		this.urlSecurityCheck(actionURI, location.href);

		let referrerURI = this.makeURI(location.href, charset, null);
		// Send the data by GET or POST:
		this._sendLoginDataWithJSP(form.method, actionURI, dataString, referrerURI);
	},

	_sendLoginDataWithJSP: function (aFormMethod, aUrl, aDataStr, aReferrer) {
		let method = aFormMethod.toLowerCase();
		if (method === "get") {
			// Add the parameter list to the url, remove existing parameters:
			let paramIndex = aUrl.indexOf("?");
			if (paramIndex === -1) {
				aUrl += "?" + aDataStr;
			}
			else {
				aUrl = aUrl.substring(0, paramIndex+1) + aDataStr;
			}
			// Load the url in the current window (params are url, referrer and post data):
			loadURI(aUrl, aReferrer, null);
		}
		else if (method === "post") {
			// Create post data mime stream (params are aStringData, aKeyword, aEncKeyword, aType):
			let postData = getPostDataStream(aDataStr, "", "", "application/x-www-form-urlencoded");
			// Load the url in the current window (params are url, referrer and post data):
			loadURI(aUrl, aReferrer, postData);
		}
		else {
			let message = "Failed Secure Login. HTTP " + method +
			              " method is not supported by Secure Login";
			Components.utils.reportError(message);
		}
	},

	_loginWithNormal: function (aSecureLoginData, aInfoObj) {
		let form            = aInfoObj.form;
		let elements        = form.elements;
		let usernameField   = aSecureLoginData.usernameField;
		let passwordField   = aSecureLoginData.passwordField;
		let loginInfo       = aSecureLoginData.loginInfo;

		// Fill the login fields:
		if (usernameField) {
			usernameField.value = this.getUsernameFromLoginObject(loginInfo);
		}
		passwordField.value = this.getPasswordFromLoginObject(loginInfo);

		if (this.prefs.getBoolPref('autoSubmitForm')) {
			// Prevent multiple submits (e.g. if submit is delayed)
			// by setting a variable (after click on a submit button):
			let submitted = false;
			// Search for the submit button:
			for (let i = 0; i < elements.length; i++) {
				let element = elements[i];
				// auto-login by clicking on the submit button:
				// The current implementation of nsILoginInfo does not have
				// identifying data of submit element in login form.
				// So it uses a first submit button which is regards as a login button 
				// according to use-case.
				if (element.type == "submit" || element.type == "image") {
					element.click();
					submitted = true;
					break;
				}
			}

			if (!submitted) {
				// No submit button found, try to submit anyway:
				form.submit();
			}
		}
		else {
			// Don't submit automatically but set the focus on the password field,
			// this way submitting can be done by hitting return on the keyboard:
			passwordField.focus();
			return;
		}
	},

	getUsernameFromLoginObject: function (aLoginObject) {
		return aLoginObject.username;
	},

	getPasswordFromLoginObject: function (aLoginObject) {
		// Both login objects (Firefox 3 and before) contain a "password" attribute:
		return aLoginObject.password;
	},

	getJSProtectExceptions: function () {
		if (!this.JSPExceptionsList) {
			this.updateJSPExceptionsList();
		}
		return this.JSPExceptionsList;
	},

	updateJSPExceptionsList: function () {
		// Get the exception list from the preferences:
		let exceptions = this.prefs
		                 .getComplexValue("exceptionList", Components.interfaces.nsISupportsString)
		                 .data.split(" ");
		return this.JSPExceptionsList = ((exceptions && exceptions[0]) ? exceptions : []);
	},

	shortcutFactory: function (aModifiers, aKey, aKeycode) {
		if (typeof arguments.callee.shortcut == 'undefined') {
			arguments.callee.shortcut = function (aModifiers, aKey, aKeycode) {
				this.modifiers = aModifiers ? aModifiers : new Array();
				this.key = aKey;
				this.keycode = aKeycode;
				this.toString = function() {
					if (this.modifiers.length) {
						return this.modifiers.join('+')+'+'+this.key+this.keycode;
					}
					else {
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
					for (let i=0; i<this.modifiers.length; i++) {
						if (this.modifiers[i] != shortcut.modifiers[i]) {
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
			let key = null;
			let keycode = null;
			let shortcutItems = this.prefs
			                    .getComplexValue('shortcut', Components.interfaces.nsIPrefLocalizedString)
			                    .data.split('+');
			if (shortcutItems.length > 0) {
				// Remove the last element and save it as key
				// the remaining shortcutItems are the modifiers:
				key = shortcutItems.pop();
				// Check if the key is a keycode:
				if (key.indexOf('VK') == 0) {
					keycode = key;
					key = null;
				}
			}
			// Create a new shortcut object:
			this.shortcut = this.shortcutFactory(shortcutItems, key, keycode);
		}
		return this.shortcut;
	},

	getFormattedShortcut: function (aShortcutParam) {
		// Get shortcut from param or take the object attribute:
		let shortcut = aShortcutParam ? aShortcutParam : this.getShortcut();
		let formattedShortcut = '';
		// Add the modifiers:
		for (let i = 0; i < shortcut['modifiers'].length; i++) {
			try {
				formattedShortcut += this.stringBundle.GetStringFromName(shortcut['modifiers'][i]) + '+';
			}
			catch (e) {
				Components.utils.reportError(e);
				// Error in shortcut string, return empty String;
				return '';
			}
		}
		if (shortcut['key']) {
			// Add the key:
			if (shortcut['key'] == ' ') {
				formattedShortcut += this.stringBundle.GetStringFromName('VK_SPACE');
			}
			else {
				formattedShortcut += shortcut['key'];
			}
		}
		else if (shortcut['keycode']) {
			// Add the keycode (instead of the key):
			try {
				formattedShortcut += this.stringBundle.GetStringFromName(shortcut['keycode']);
			} catch (e) {
				// If no localization is available just use the plain keycode:
				formattedShortcut += shortcut['keycode'].replace('VK_', '');
			}
		}
		return formattedShortcut;
	},

	showDialog: function (aUrl, aParams) {
		let paramObject = aParams ? aParams : this;
		return window.openDialog(
		  aUrl,
		  '',
		  'chrome=yes,resizable=yes,toolbar=yes,centerscreen=yes,modal=no,dependent=no,dialog=no',
		  paramObject
		);
	},

	showPasswordManager: function () {
		let params = new Object();
		try {
			// Filter the passwords list with the current host as filterString:
			params.filterString = this.getContentDocument().location.host;
		}
		catch (e) {
			// Invalid location.host, e.g. about:config
		}
		this.showDialog(
		  'chrome://passwordmgr/content/passwordManager.xul',
		  params
		);
	},

	urlSecurityCheck: function (aUrl, aSourceURL) {
		try {
			this.securityManager.checkLoadURIStr(aSourceURL, aUrl, Components.interfaces.nsIScriptSecurityManager.STANDARD);
		}
		catch (e) {
			throw 'Loading of ' + url + ' denied.';
		}
	},

	makeURI: function (aURI, aOriginCharset, aBaseURI) {
		let absoluteURI;
		try {
			absoluteURI = Services.io.newURI(aURI, aOriginCharset, null);
		}
		catch (e) {
			// make absolute URI, if aURI is relative one.
			let tempURI = Services.io.newURI(aBaseURI, aOriginCharset, null).resolve(aURI);
			absoluteURI = Services.io.newURI(tempURI, aOriginCharset, null);
		}
		return absoluteURI;
	},

	urlEncode: function (aString, aCharset) {
		if(aCharset.toUpperCase() == "UTF-8") {
			// encodeURIComponent encodes the strings by using escape sequences
			// representing the UTF-8 encoding of the character:
			return encodeURIComponent(aString);
		}
		else {
			// This escapes characters representing the given charset,
			// it won't work if the given string is not part of the charset
			return this.textToSubURI.ConvertAndEscape(aCharset, aString);
		}
	},

	get textToSubURI () {
		delete this.textToSubURI;
		return this.textToSubURI = Components.classes['@mozilla.org/intl/texttosuburi;1']
		                           .getService(Components.interfaces.nsITextToSubURI);
	},

	getUnicodeString: function (aStringData) {
		// Create an Unicode String:
		let str = Components.classes['@mozilla.org/supports-string;1']
		          .createInstance(Components.interfaces.nsISupportsString);
		// Set the String value:
		str.data = aStringData;
		// Return the Unicode String:
		return str;
	},

	get stringBundle () {
		delete this.stringBundle;
		return this.stringBundle = Services.strings.createBundle("chrome://secureLogin/locale/secureLogin.properties");
	},

	getContentDocument: function(aContentWindow) {
		return aContentWindow ? aContentWindow.document : this.getBrowser().contentDocument;
	},

	getContentWindow: function () {
		return this.getBrowser().contentWindow;
	},

	getBrowser: function () {
		if (window.gBrowser) {
			// Existing window.gBrowser
			return gBrowser;
		}
		else {
			// gBrowser is not available, so make use of the WindowMediator service instead:
			return Services.wm.getMostRecentWindow('navigator:browser').gBrowser;
		}
	},

	get securityManager () {
		delete this.securityManager;
		return this.securityManager = Components.classes['@mozilla.org/scriptsecuritymanager;1']
		                              .getService(Components.interfaces.nsIScriptSecurityManager);
	},

	inArray: function (aArray, aItem) {
		let item = aItem;
		let isInArray = aArray.some(function(aElm, aElmIndex, aTraversedArray){
			return (aElm === item);
		});
		return isInArray;
	},

	openHelp: function (aTopic) {
		if (!aTopic) {
			aTopic = '';
		}
		let url = this.prefs.getCharPref('helpURL').replace(/\[TOPIC\]$/, aTopic);
		this.openNewTab(url, true);
	},

	openNewTab: function (aUrl, aFocus) {
		let helpTab = this.getBrowser().addTab(aUrl);
		if (aFocus) {
			this.getBrowser().selectedTab = helpTab;
			Services.wm.getMostRecentWindow('navigator:browser').focus();
		}
	},

	finalizeSignonAutofillFormsStatus: function () {
		// Re-enable the prefilling of login forms if setting has been true:
		try {
			if(this.modify_signon_autofillForms) {
				Services.prefs.getBranch('').setBoolPref('signon.autofillForms', true);
			}
		}
		catch(e) {
			Components.utils.reportError(e);
		}
	},

	finalize: function () {
		this.finalizeSignonAutofillFormsStatus();

		// Remove the listener from the browser object:
		try {
			gBrowser.removeProgressListener(this.progressListener);
		}
		catch(e) {
			Components.utils.reportError(e);
		}

		// Remove the preferences Observer:
		this.prefs.removeObserver('', this);
	},
};