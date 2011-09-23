/*
 * @package secureLogin
 * @author Sebastian Tschan
 * @copyright (c) Sebastian Tschan
 * @license GNU General Public License
 * @link https://blueimp.net/mozilla/
 */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
var secureLogin = {

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
			this.searchLoginsInitialize(aProgress.DOMWindow, true);
		}
	},

	// Variable to define if the progress listener has been registered to the browser:
	isProgressListenerRegistered: null,
	// Helper var to remember original autofillForms setting (this has nothing to to with the extension autofillForms@blueimp.net:
	autofillForms: null,
	// Valid logins list:
	secureLogins: null,
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

	// cache to preferences about doorhanger notification:
	showDoorHanger: null,
	showDoorHangerDismissed: null,

	observe: function (aSubject, aTopic, aData) {
		// Only observe preferences changes:
		if (aTopic != 'nsPref:changed') {
			return;
		}
		switch (aData) {
			case 'searchLoginsOnload':
				this.searchLoginsOnloadUpdate();
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
			case "showDoorHanger":
			case "showDoorHanger.dismissed":
				this.updateShowDoorhanger();
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

		// Add the progress listener to the browser, set the Secure Login icons:
		this.searchLoginsOnloadUpdate();
	},

	initializeSignonAutofillFormsStatus: function () {
		// Disable the prefilling of login forms if enabled, remember status:
		try {
			let rootPrefBranch = Services.prefs.getBranch('');
			if (rootPrefBranch.getBoolPref('signon.autofillForms')) {
				rootPrefBranch.setBoolPref('signon.autofillForms', false);
				this.autofillForms = true;
			}
			else {
				this.autofillForms = false;
			}
		}
		catch (e) {
			Components.utils.reportError(e);
		}
	},

	searchLoginsOnloadUpdate: function () {
		let isSearchLoginsOnload = this.prefs.getBoolPref("searchLoginsOnload");

		// set internal variable:
		this.searchLoginsOnload = isSearchLoginsOnload;

		this.progressListenerUpdate(isSearchLoginsOnload);

		if (isSearchLoginsOnload) {
			// Search for valid logins and outline login fields:
			this.searchLoginsInitialize(null, true);
		}
		else {
			// Always highlight the Secure Login icons, when not searching for valid logins automatically:
			this.notifyUpdateLoginButton(true);
			this.notifyShowDoorHangerLogin();
		}
	},

	progressListenerUpdate: function (aIsSearchLoginsOnload) {
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
		if (this.showDoorHanger) {
			this._notifyUpdateLoginIcon("showDoorHangerLogin");
		}
	},

	_notifyUpdateLoginIcon: function (aData) {
		let subject   = { wrappedJSObject: window };
		Services.obs.notifyObservers(subject, this.obsTopic, aData);
	},

	updateShowDoorhanger: function () {
		let pref = this.prefs;
		this.showDoorHanger = pref.getBoolPref("showDoorHanger");
		this.showDoorHangerDismissed = pref.getBoolPref("showDoorHanger.dismissed");
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

		if (this.secureLogins) {
			// Update the outlined form fields:
			let secureLogins = this.secureLogins;
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

	searchLoginsInitialize: function (aWin, aUpdateStatus) {
		if (!aWin) {
			aWin = this.getContentWindow();
		}

		if (aWin.frameElement && this.secureLogins) {
			// If aWin is embedded window into an element,
			// this part removes the embeded or closed window from logins of all remaining windows:
			for (let i = 0, secureLogins = this.secureLogins; i < secureLogins.length; ++i) {
				let window = secureLogins[i].window;
				// Remove the window from list
				// if the window is this frame window or has closed already:
				if (window === aWin || window.closed) {
					secureLogins.splice(i, 1);
				}
			}
		} else {
			// Reset the found logins and helper lists:
			this.secureLogins = null;
		}

		// Show form index only if more than one valid login form is found:
		this.showFormIndex = false;

		// Search for valid logins on the given window:
		this.searchLogins(aWin);

		if (aUpdateStatus) {
			this.updateLoginsFoundStatus();
		}
	},

	updateLoginsFoundStatus: function () {
		let secureLogins = this.secureLogins;
		let subject = { wrappedJSObject: window };
		if (secureLogins && secureLogins.length > 0) {
			this.notifyUpdateLoginButton(true);
			this.notifyShowDoorHangerLogin();
			// Play sound notification:
			if (this.prefs.getBoolPref('playLoginFoundSound')) {
				this.playSound('loginFoundSoundFileName');
			}
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
				let isSkipDuplicateActionForms = this.prefs.getBoolPref('skipDuplicateActionForms');

 				// Go through the forms:
 				for (let i = 0; i < forms.length; i++) {
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
					// Go through the logins:
					for (let j = 0; j < loginInfos.length; j++) {
						// Get valid login fields:
						let loginInfo = loginInfos[j];
						let loginFields = this.getLoginFields(form, loginInfo.usernameField, loginInfo.passwordField);

						if (loginFields) {
							if (isSkipDuplicateActionForms) {
								// Add the formURI to the list:
								formURIs.push(formURI);
							}

							let foundLogin = {
								loginObject  : loginInfo,
								formIndex    : i,
								window       : aWin,
								usernameField: loginFields.usernameField,
								passwordField: loginFields.passwordField,
								actionURIStr : formURI.spec,
							};
							// Add null as login object to the logins list to avoid a Master Password prompt:
							this.addToFoundLoginsList(foundLogin);

							// highlight login fields:
							this.highlightLoginFields(loginFields.usernameField, loginFields.passwordField);

							// decrement loginsCount
							loginsCount--;
						}
					}
				}
			}
		}

		// Recursive call for all subframes:
		for (let f=0; f < aWin.frames.length; f++) {
			this.searchLogins(aWin.frames[f]);
		}
	},

	getLoginFields: function (aForm, aLoginUsernameFieldName, aLoginPasswordFieldName) {

		// The form fields for user+pass:
		let usernameField = null;
		let passwordField = null;

		// helper var to define if the login form is a password only form:
		let inputOtherTypeFound = false;

		// The form elements list:
		let elements = aForm.elements;

		let userInput = elements[aLoginUsernameFieldName];
		if (userInput) {
			inputOtherTypeFound = true;
			usernameField = userInput;
		}

		let passInput = elements[aLoginPasswordFieldName];
		if (passInput && passInput.type == "password") {
			passwordField = passInput;
		}

		if (passwordField) {
			// If this is a password only form,
			// no input which type is not password may be found and userFieldName must be empty:
			if (!usernameField && (inputOtherTypeFound || aLoginUsernameFieldName)) {
				return null;
			}

			let loginFields = {
				usernameField: usernameField,
				passwordField: passwordField,
			};

			return loginFields;
		}
		else {
			return null;
		}
	},

	addToFoundLoginsList: function (aFoundLogin) {
		// Lazy initialization of the logins and helper lists:
		if (!this.secureLogins) {
			// New valid logins list:
			this.secureLogins = new Array();
		}

		let loginIndex = this.secureLogins.length;

		// Test if there is only one valid login form:
		let isInArray = this.secureLogins.some(function(aElm){
			return (aElm.formIndex === aFoundLogin.formIndex);
		});
		if (!this.showFormIndex
		    && (loginIndex > 0)
		    && !isInArray
		) {
			this.showFormIndex = true;
		}

		// Save the login in the valid logins list:
		this.secureLogins[loginIndex] = {
			loginObject    : aFoundLogin.loginObject,
			formIndex      : aFoundLogin.formIndex,
			window         : aFoundLogin.window,
			usernameField  : aFoundLogin.usernameField,
			passwordField  : aFoundLogin.passwordField,
			actionURI      : aFoundLogin.actionURIStr,
		};
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

	get masterSecurityDevice () {
		delete this.masterSecurityDevice;
		return this.masterSecurityDevice = Components.classes['@mozilla.org/security/pk11tokendb;1']
		                                   .getService(Components.interfaces.nsIPK11TokenDB);
	},

	masterSecurityDeviceLogout: function (aEvent) {
		let masterSecurityDevice = this.masterSecurityDevice;
		if (masterSecurityDevice.getInternalKeyToken().isLoggedIn()) {
			masterSecurityDevice.findTokenByName('').logoutAndDropAuthenticatedResources();
		}
		let label = this.stringBundle.GetStringFromName("masterSecurityDeviceLogout");
		let subject = {
			label: label,
		};
		Services.obs.notifyObservers({ wrappedJSObject: subject, }, this.obsTopic, "showAndRemoveNotification");
	},

	get loginUserSelectionPopup () {
		delete this.loginUserSelectionPopup;
		return this.loginUserSelectionPopup = document.getElementById('secureLoginUserSelectionPopup');
	},

	userSelectionLogin: function (aEvent) {
		if (aEvent.ctrlKey) {
			this.masterSecurityDeviceLogout();
			return;
		}

		// Search for valid logins and outline login fields if not done automatically:
		if (!this.searchLoginsOnload) {
			this.searchLoginsInitialize(null, false);
		}

		// Check for valid logins:
		if (this.secureLogins && this.secureLogins.length > 0) {
			if (this.secureLogins.length > 1) {
				// Determine if no master password is set or the user has already been authenticated:
				let masterPasswordRequired = true;
				let token = this.masterSecurityDevice.getInternalKeyToken();
				if (!token.needsLogin() || token.isLoggedIn()) {
					masterPasswordRequired = false;
				}
				let popup = this.loginUserSelectionPopup;
				if (popup && typeof popup.openPopup == 'function' && !masterPasswordRequired) {
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
					this.login(null, null, true);
				}
			}
			else {
				// Just login with the single available username:
				this.login(null, 0, true);
			}
		}
	},

	prepareUserSelectionPopup: function (aPopup) {
		// Remove the old child nodes (should be already removed by the popuphiding event):
		while (aPopup.hasChildNodes()) {
			aPopup.removeChild(aPopup.firstChild);
		}
		let secureLogins = this.secureLogins;
		if (secureLogins) {
			let menuitem = document.createElement('menuitem');
			menuitem.setAttribute('class','menuitem-iconic secureLoginUserIcon');
			// Add a menuitem for each available user login:
			for (let i = 0; i < secureLogins.length; i++) {
				let username = this.getUsernameFromLoginObject(secureLogins[i].loginObject);
				// Show form index?
				if (this.showFormIndex) {
					username += '  (' + this.secureLogins[i].formIndex + ')';
				}
				menuitem = menuitem.cloneNode(false);
				menuitem.setAttribute('label',username);
				menuitem.setAttribute('oncommand','secureLogin.login(null, '+i+', true);');
				aPopup.appendChild(menuitem);
			}
		}
	},

	login: function(aWin, aLoginIndex, aSkipLoginSearch) {
		if (!aWin || !aWin.document) {
			aWin = this.getContentWindow();
		}

		// Search for valid logins and outline login fields if not done automatically:
		let isSearchLoginsOnload = this.searchLoginsOnload;
		if (!isSearchLoginsOnload && !aSkipLoginSearch) {
			this.searchLoginsInitialize(aWin, false);
		}

		// Check for valid logins:
		if (this.secureLogins && this.secureLogins.length > 0) {
			try {
				// The list index of the login:
				let selectedIndex;
				if (this.secureLogins.length > 1) {
					// Prompt for a selection, if list contains more than one login:
					selectedIndex = this._selectLoginAccount(aLoginIndex);
				}
				else {
					selectedIndex = 0;
				}

				// Cache login data:
				let secureLoginData = this.secureLogins[selectedIndex];

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

				// The form elements list:
				let elements = form.elements;

				// The charset of the given document:
				let charset = document.characterSet;

				// Get the target url from the form action value or if empty from the current document:
				let actionURI = secureLoginData.actionURI;

				// If JavaScript protection is to be used, check the exception list:
				let useJavaScriptProtection = this._useJavaScriptProtection(location);

				let loginInfos = {
					location       : location,
					elements       : elements,
					form           : form,
					actionURI      : actionURI,
					charset        : charset,
					secureLoginData: secureLoginData,
				};

				// Send login data without using the form:
				if (useJavaScriptProtection) {
					this._loginWithJSProtection(loginInfos);
				}
				else {
					this._loginWithNormal(loginInfos);
				}

				// Play sound notification:
				if (this.prefs.getBoolPref('playLoginSound')) {
					this.playSound('loginSoundFileName');
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
		// Check if the loginIndex contains an index to select:
		if ((typeof aLoginIndex != "undefined")
		    && (!isNaN(parseInt(aLoginIndex)))
		    && (aLoginIndex < this.secureLogins.length)
		) {
			selectedIndex = aLoginIndex;
		}
		else {
			let list = new Array(this.secureLogins.length);
			for (let i = 0; i < this.secureLogins.length; i++) {
				list[i] = this.getUsernameFromLoginObject(this.secureLogins[i].loginObject);
				// Show form index?
				if (this.showFormIndex) {
					list[i] += '  (' + this.secureLogins[i].formIndex + ')';
				}
			}
			let selected = {};

			let selectionPrompt = this.stringBundle.GetStringFromName('loginSelectionPrompt');
			if (this.showFormIndex) {
				selectionPrompt += '  (' + this.stringBundle.GetStringFromName('formIndex') + ')';
			}

			let ok = Services.prompt.select(
				window,
				this.stringBundle.GetStringFromName('loginSelectionWindowTitle'),
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
		return selectedIndex;
	},

	_useJavaScriptProtection: function (aLocation) {
		let useJavaScriptProtection = this.prefs.getBoolPref("javascriptProtection");
		let jsProtectExceptionArray = this.getJSProtectExceptions();
		let isInException = this.inArray(jsProtectExceptionArray, aLocation.protocol + "//" + aLocation.host);
		return (useJavaScriptProtection && !isInException) ? true : false;
	},

	_loginWithJSProtection: function (aInfoObj) {
		let location        = aInfoObj.location;
		let elements        = aInfoObj.elements;
		let form            = aInfoObj.form;
		let url             = aInfoObj.actionURI;
		let charset         = aInfoObj.charset;
		let secureLoginData = aInfoObj.secureLoginData;
		let usernameField   = secureLoginData.usernameField;
		let passwordField   = secureLoginData.passwordField;
		let loginObject     = secureLoginData.loginObject;

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
					addToDataString(
					  passwordField.name,
					  this.getPasswordFromLoginObject(loginObject)
					);
					break;
				case 'select-multiple':
					for (let j = 0; j < element.options.length; j++) {
						if (element.options[j].selected) {
							addToDataString(element.name, element.options[j].value);
						}
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
					if (!submitButtonFound) {
						addToDataString(element.name, element.value);
						submitButtonFound = true;
					}
					break;
				default:
					if (!usernameField || element.name != usernameField.name) {
						addToDataString(element.name, element.value);
					}
					else {
						// This is the userName field - use the saved username as value:
						addToDataString(
						  usernameField.name,
						  this.getUsernameFromLoginObject(loginObject)
						);
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

		// Check if the url is an allowed one (throws an exception if not):
		this.urlSecurityCheck(url, location.href);

		let referrerURI = this.makeURI(location.href, charset, null);
		// Send the data by GET or POST:
		this._sendLoginDataWithJSP(form.method, url, dataString, referrerURI);
	},

	_sendLoginDataWithJSP: function (aFormMethod, aUrl, aDataStr, aReferrer) {
		if (aFormMethod && aFormMethod.toLowerCase() === "get") {
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
		else {
			// Create post data mime stream (params are aStringData, aKeyword, aEncKeyword, aType):
			let postData = getPostDataStream(aDataStr, "", "", "application/x-www-form-urlencoded");
			// Load the url in the current window (params are url, referrer and post data):
			loadURI(aUrl, aReferrer, postData);
		}
	},

	_loginWithNormal: function (aInfoObj) {
		let elements        = aInfoObj.elements;
		let form            = aInfoObj.form;
		let secureLoginData = aInfoObj.secureLoginData;
		let usernameField   = secureLoginData.usernameField;
		let passwordField   = secureLoginData.passwordField;
		let loginObject     = secureLoginData.loginObject;

		// Fill the login fields:
		if (usernameField) {
			usernameField.value = this.getUsernameFromLoginObject(loginObject);
		}
		passwordField.value = this.getPasswordFromLoginObject(loginObject);

		if (this.prefs.getBoolPref('autoSubmitForm')) {
			// Prevent multiple submits (e.g. if submit is delayed)
			// by setting a variable (after click on a submit button):
			let submitted = false;
			// Search for the submit button:
			for (let i = 0; i < elements.length; i++) {
				let element = elements[i];
				// auto-login by clicking on the submit button:
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

	playSound: function(aPrefName) {
		try {
			// Get the filename stored in the preferences:
			let file = this.prefs.getComplexValue(aPrefName, Components.interfaces.nsILocalFile);

			// Get an url for the file:
			let url = Services.io.newFileURI(file, null, null);

			// Play the sound:
			this.getSound().play(url);
		}
		catch (e) {
			Components.utils.reportError(e);
			// No file found
		}
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
		if(aCharset == 'UTF-8') {
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

	getContentDocument: function(aWin) {
		if (aWin) {
			return aWin.document;
		}
		else {
			return this.getBrowser().contentDocument;
		}
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

	getSound: function () {
		return Components.classes['@mozilla.org/sound;1']
		       .createInstance(Components.interfaces.nsISound);
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
			if(this.autofillForms) {
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