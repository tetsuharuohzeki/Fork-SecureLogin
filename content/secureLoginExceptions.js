/*
 * @package secureLogin
 * @author Sebastian Tschan
 * @copyright (c) Sebastian Tschan
 * @license GNU General Public License
 * @link https://blueimp.net/mozilla/
 */
var secureLoginExceprions = {

	get service() {
		delete this.service;
		return this.service = secureLogin;
	},

	get addExceptionTextbox () {
		delete this.addExceptionTextbox;
		return this.addExceptionTextbox = document.getElementById('addExceptionTextbox');
	},

	get removeAllButton () {
		delete this.removeAllButton;
		return this.removeAllButton = document.getElementById('removeAllButton');
	},

	get removeSelectedButton () {
		delete this.removeSelectedButton;
		return this.removeSelectedButton = document.getElementById('removeSelectedButton');
	},

	// The exceptions tree object:
	get exceptionsTree () {
		delete this.exceptionsTree;
		return this.exceptionsTree = document.getElementById('exceptionsTree');
	},

	exceptions: null,// Temporary exceptions list copy for the exceptions window:
	exceptionsTreeSelection: null,// The exceptions treeSelection object:
	exceptionsTreeBox: null,// The exceptions treeBox object:
	exceptionsAscending: null,// Determines if exceptions sort is to be ascending or descending:

	// The exceptions treeView object
	get exceptionsTreeView () {
		delete this.exceptionsTreeView;
		// Implement the TreeView interface:
		let self = this;
		this.exceptionsTreeView = {
			rowCount: 0,
			setTree: function (aTree) {},
			getImageSrc: function (aRow, aColumn) {},
			getProgressMode: function (aRow, aColumn) {},
			getCellValue: function (aRow, aColumn) {},
			getCellText: function (aRow, aColumn) {
				if (aColumn.id=='exceptionsCol') {
					return self.exceptions[aRow];
				}
				else {
					return '';
				}
			},
			isSeparator: function (aIndex) { return false; },
			isSorted: function () { return false; },
			isContainer: function (aIndex) { return false; },
			cycleHeader: function (aColumn) {},
			getRowProperties: function (aRow, aProp) {},
			getColumnProperties: function (aColumn, aProp) {},
			getCellProperties: function (aRow, aColumn, aProp) {},
			getParentIndex: function (aIndex) { return -1; }
		};

		return this.exceptionsTreeView;
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

		this.exceptionsInitialize();
	},

	onUnLoad: function() {
		window.removeEventListener("unload", this, false);

		this.exceptionsFinalize();
	},

	exceptionsInitialize: function () {
		// Copy the secureLogin exception array into the local list:
		this.exceptions = this.service.getJSProtectExceptions().slice();

		// Set the tree length using the exception list length:
		this.exceptionsTreeView.rowCount = this.exceptions.length;

		// Enable the "removeAllButton" if exceptions are stored:
		if (this.exceptionsTreeView.rowCount > 0) {
			this.removeAllButton.setAttribute('disabled', 'false');
		}

		try {
			let doc = this.service.getDoc();
			// Set the textbox to the current host:
			let textbox = this.addExceptionTextbox;
			textbox.value = doc.location.protocol + '//' + doc.location.host;
		} catch(e) {
			// Invalid location.host, e.g. about:config
		}

		// Assign the treeview:
		this.exceptionsTree.view = this.exceptionsTreeView;

		// The TreeSelection object:
		this.exceptionsTreeSelection = this.exceptionsTree.view.selection;

		// The TreeBox object:
		this.exceptionsTreeBox = this.exceptionsTree.treeBoxObject;

		// Sort is to be ascending if clicked first:
		this.exceptionsAscending = true;
	},

	exceptionsFinalize: function () {
	},

	setExceptions: function (aExceptions) {
		// Store the exceptions separated by spaces as unicode string in the preferences:
		this.service.prefs.setComplexValue(
			'exceptionList',
			Components.interfaces.nsISupportsString,
			this.service.getUnicodeString(aExceptions.join(' '))
		);
	},

	exceptionsAdd: function (aEvent) {
		let url = this.addExceptionTextbox.value;
		// Get the prePath information from the given URL:
		try {
			url = this.service.makeURI(url, 'UTF-8', null).prePath;
		} catch (e) {
			try {
				// Try adding "http://" in front of the url:
				url = this.service.makeURI('http://'+url, 'UTF-8', null).prePath;
			} catch (e) {
				// The given URL is not a valid one, log and return:
				this.service.log('Invalid URL: '+url);
				return;
			}
		}

		// Check if the url is already in the list:
		if (this.service.inArray(this.exceptions, url)) {
			return;
		}

		// Add the url to the list:
		this.exceptions.push(url);

		// Update the tree count and notify the tree:
		this.exceptionsTreeView.rowCount++;
		this.exceptionsTreeBox.rowCountChanged(this.exceptionsTreeView.rowCount, +1);
		this.exceptionsTreeBox.invalidate();

		// Update the preferences:
		this.setExceptions(this.exceptions);

		// Enable the "removeAllButton":
		this.removeAllButton.setAttribute('disabled', 'false');
	},

	exceptionsHandleKeyPress: function (aEvent) {
		if (aEvent.keyCode == 46) {
			this.exceptionsRemoveSelected();
		} else if (aEvent.ctrlKey && aEvent.which == 97) {
			if (this.exceptionsTree && this.exceptionsTreeSelection) {
				try {
					// Select all rows:
					this.exceptionsTreeSelection.selectAll();
				} catch (e) {
					this.service.log(e);
				}
			}
		}
	},

	exceptionsSelected: function (aEvent) {
		if (this.exceptionsTreeSelection.count > 0) {
			this.removeSelectedButton.setAttribute('disabled', 'false');
		}
	},

	exceptionsSort: function (aEvent) {
		// Sort the exception list:
		this.exceptions.sort();
		if (this.exceptionsAscending) {
			this.exceptionsAscending = false;
		}
		else {
			this.exceptions.reverse();
			this.exceptionsAscending = true;
		}

		// Notify the tree:
		this.exceptionsTreeBox.invalidate();

		// Clear out selections
		this.exceptionsTreeSelection.select(-1);

		// Disable "remove" button:
		this.removeSelectedButton.setAttribute("disabled", "true");
	},

	exceptionsRemoveSelected: function (aEvent) {
		// Start of update batch:
		this.exceptionsTreeBox.beginUpdateBatch();

		// Helper object to store a range:
		function Range(start, end) {
			this.start = start.value;
			this.end = end.value;
		}

		// List of ranges:
		let ranges = new Array();

		// Get the number of ranges:
		let numRanges = this.exceptionsTreeSelection.getRangeCount();

		// Helper vars to store the range end points:
		let start = new Object();
		let end = new Object();

		// We store the list of ranges first, as calling
		// this.exceptionsTreeBox.rowCountChanged()
		// seems to invalidate the current selection

		for (let i = 0; i < numRanges; i++) {
			// Get the current range end points:
			this.exceptionsTreeSelection.getRangeAt(i,start,end);
			// Store them as a Range object in the ranges list:
			ranges[i] = new Range(start, end);
		}

		for (let i = 0; i < numRanges; i++) {
			// Go through the stored ranges:
			for (let j = ranges[i].start; j <= ranges[i].end; j++) {
				// Set the selected exceptions to null:
				this.exceptions[j] = null;
			}

			// Calculate the new tree count:
			let count = ranges[i].end - ranges[i].start + 1;

			// Update the tree count and notify the tree:
			this.exceptionsTreeView.rowCount -= count;
			this.exceptionsTreeBox.rowCountChanged(ranges[i].start, -count);
		}

		// Collapse list by removing all the null entries
		for (let i = 0; i < this.exceptions.length; i++) {
			if (!this.exceptions[i]) {
				let j = i;
				while (j < this.exceptions.length && !this.exceptions[j]) {
					j++;
				}
				this.exceptions.splice(i, j-i);
			}
		}

		// Clear out selections
		this.exceptionsTreeSelection.select(-1); 

		// End of update batch:
		this.exceptionsTreeBox.endUpdateBatch();

		// Disable buttons:
		if (this.exceptions.length == 0) {
			this.removeAllButton.setAttribute("disabled","true");
		}
		this.removeSelectedButton.setAttribute("disabled", "true");

		// Update the preferences:
		this.setExceptions(this.exceptions);
	},

	exceptionsRemoveAll: function () {
		// The number of currently stored exceptions:
		let count = this.exceptions.length;
	
		// Empty the list:
		this.exceptions = new Array();

		// Clear out selections
		this.exceptionsTreeSelection.select(-1);

		// Update the tree view and notify the tree
		this.exceptionsTreeView.rowCount = 0;
		// On deletion, notify from which index and how many rows have been deleted:
		this.exceptionsTreeBox.rowCountChanged(0, -count);
		this.exceptionsTreeBox.invalidate();

		// Disable buttons
		this.removeSelectedButton.setAttribute("disabled", "true")
		this.removeAllButton.setAttribute("disabled","true");

		// Update the preferences:
		this.setExceptions(this.exceptions);
	},

};
window.addEventListener("load", secureLoginExceprions, false);
