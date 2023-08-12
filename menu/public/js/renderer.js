
document.onreadystatechange = (event) => {
    if (document.readyState == "complete") {
        document.getElementById('min-button').addEventListener("click", event => {
	    	document.body.classList.remove('maximized');
	        ipcRenderer.send('windowManage','minimize');
	    });

        document.getElementById('close-button').addEventListener("click", event => {
	        ipcRenderer.send('windowManage','close');
	    });

	    document.getElementById('max-button').addEventListener("click", event => {
	    	$('#main').fadeIn(100);
	    	// document.getElementById('main').style.display = "flex";
	    	document.getElementById('max-button').style.display = "none";
	    	document.getElementById('restore-button').style.display = "flex";

	        ipcRenderer.send('windowManage','maximize');
	    });

	    document.getElementById('restore-button').addEventListener("click", event => {
	    	$('#main').hide();
	    	// document.getElementById('main').style.display = "none";
	    	document.getElementById('restore-button').style.display = "none";
	    	document.getElementById('max-button').style.display = "flex";

	        ipcRenderer.send('windowManage','unmaximize');
	    });
    }
};

window.onbeforeunload = (event) => {
    // win.removeAllListeners();
}