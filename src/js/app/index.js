var UI = require('ui');
var ajax = require('ajax');
var Accel = require('ui/accel');

var X2JS = require('xml2json');
var xml2json = new X2JS();

/**
 * Generates URL in order to fetch palinas around the given position
 * @param {Number} x1 the start latitude
 * @param {Number} y1 the start longitude
 * @param {Number} x2 the end latitude
 * @param {Number} y2 the end longitude
 * @return {String} the final URL string
 */
 function generatePalinasURL(x1, y1, x2, y2, z) {
  return 'http://travel.mob.cotralspa.it:7777/beApp/PIV.do?cmd=7&pX1=' + x1 + '&pY1=' + y1 + '&pX2=' + x2 + '&pY2=' + y2 + '&pZ=' + z;
}

/**
 * Generates URL in order to fetch routes passing in the given palina
 * @param {Number} palinaCode the palina's code
 * @return {String} the final URL string
 */
function generateRoutesURL(palinaCode) {
  return 'http://travel.mob.cotralspa.it:7777/beApp/PIV.do?cmd=1&pCodice=' + palinaCode + '&pFormato=xml&pDelta=5000';
}

/**
 * Generates URL in order to fetch stops of the given route
 * @param {Number} routeCode the route's code
 * @return {String} the final URL string
 */
function generateStopsURL(routeCode) {
  return 'http://travel.mob.cotralspa.it:7777/beApp/Corse.do?cmd=SC&pCorsa=' + routeCode + '&pFormato=xml';
}

/**
 * Converts millis in hours:minutes
 * @param {Number} millis the millis to convert
 * @return {String} the time in hours:minutes format
 */
function convertTime(millis) {
  var hours = Math.trunc(millis / 3600);
  if (hours < 10) {
    hours = '0' + hours;
  }

  var minutes = Math.round((millis / 3600 - hours) * 60);
  if (minutes < 10) {
    minutes = '0' + minutes;
  }
  
  return hours + ':' + minutes;
}

/**
 * Gets current position and fetches palinas around the position
 * @param {Float} radius the radius of the are to fetch
 */
function fetchPalinasFromCurrentPosition(radius) {
  // Ask to current position
  navigator.geolocation.getCurrentPosition(
    function locationSuccess(pos) {
      // Fetch palinas around the current position
      fetchPalinas(pos.coords.latitude, pos.coords.longitude, radius);
    },
    function locationError(err) {
      if(err.code == err.PERMISSION_DENIED) {
        var errorMessage = 'Location access was denied by the user.';
        console.error(errorMessage);

        errorCard.body(errorMessage);
        errorCard.show();
      } else {
        var errorMessage = 'Location error (' + err.code + '): ' + err.message;
        console.error(errorMessage);

        errorCard.body(errorMessage);
        errorCard.show();
      }
    },
    {
      enableHighAccuracy: true, 
      maximumAge: 10000, 
      timeout: 10000
    }
  );
}

/**
 * Parses palinas JSON in order to create Pebble menu's items
 * @param {JSON} data the JSON to parse 
 * @return {Item[]} the menu's items 
 */
function parsePalinas(data) {
  var items = [];
  
  var numberOfPalinas = data.paline._estratte;
  if (numberOfPalinas == 1) {
    // Get palinas name
    var title = data.paline.palina.nomePalina;

    // Get palinas destinations
    var destinations;
    var destinationsNumbers = data.paline.palina.destinazioni._num;
    if (destinationsNumbers == 1) {
      destinations = data.paline.palina.destinazioni.destinazione;
    } else {
      destinations = '';
      for(var j = 0; j < data.paline.palina.destinazioni._num; j++) {
        destinations += data.paline.palina.destinazioni.destinazione[j] + ' ';
      }
    }
    // Add to menu items array
    items.push({
      title: title,
      subtitle: destinations
    });  
  } else {
    for(var i = 0; i < numberOfPalinas; i++) {
      // Get palinas name
      var title = data.paline.palina[i].nomePalina;

      // Get palinas destinations
      var destinations;
      var destinationsNumbers = data.paline.palina[i].destinazioni._num;
      if (destinationsNumbers == 1) {
        destinations = data.paline.palina[i].destinazioni.destinazione;
      } else {
        destinations = '';
        for(var j = 0; j < data.paline.palina[i].destinazioni._num; j++) {
          destinations += data.paline.palina[i].destinazioni.destinazione[j] + ' ';
        }
      }
      // Add to menu items array
      items.push({
        title: title,
        subtitle: destinations
      });
    }
  }

  // Finally return whole array
  return items;
};

/**
 * Parses routes JSON in order to create Pebble menu's items
 * @param {JSON} data the JSON to parse 
 * @return {Item[]} the menu's items 
 */
function parseRoutes(data) {
  var items = [];
  var numberOfRoutes = data.transiti._estratti;
  if (numberOfRoutes == 1) {
    // Get arrival 
    var arrivalDestination = data.transiti.corsa.arrivoCorsa;

    // Get timing
    var transitTime = data.transiti.corsa.tempoTransito;
    var delay = data.transiti.corsa.ritardo;

    var time;
    if (delay > 0) {
      time = convertTime(transitTime) + ' (+' + Math.round(delay / 60) + 'm)';
    } else if (delay < 0) {
      time = convertTime(transitTime) + ' (' + Math.ceil(delay / 60) + 'm)';
    } else {
      time = convertTime(transitTime)
    }

    // Add to menu items array
    items.push({
      title: arrivalDestination,
      subtitle: time
    });
  } else {
    for(var i = 0; i < numberOfRoutes; i++) {
      // Get arrival 
      var arrivalDestination = data.transiti.corsa[i].arrivoCorsa;

      // Get timing
      var transitTime = data.transiti.corsa[i].tempoTransito;
      var delay = data.transiti.corsa[i].ritardo;

      var time;
      if (delay > 0) {
        time = convertTime(transitTime) + ' (+' + Math.round(delay / 60) + 'm)';
      } else if (delay < 0) {
        time = convertTime(transitTime) + ' (' + Math.ceil(delay / 60) + 'm)';
      } else {
        time = convertTime(transitTime)
      }

      // Add to menu items array
      items.push({
        title: arrivalDestination,
        subtitle: time
      });
    }  
  }

  // Finally return whole array
  return items;
};

/**
 * Parses stops JSON in order to create Pebble menu's items
 * @param {JSON} data the JSON to parse 
 * @return {Item[]} the menu's items 
 */
function parseStops(data) {
  var items = [];

  var numberOfStops = data.corsa.fermate._estratte;
  if (numberOfStops == 1) {
    // Get arrival 
    var stop = data.corsa.fermate.fermata.rif;

    // Get timing
    var programmaticTime = data.corsa.fermate.fermata.PP;
    var registeredTime = data.corsa.fermate.fermata.PR;

    if (registeredTime != "null") {
      time = convertTime(programmaticTime) + " - " + convertTime(registeredTime);
    } else {
      time = convertTime(programmaticTime);
    }

    // Add to menu items array
    items.push({
      title: stop,
      subtitle: time
    });  
  } else {
    for(var i = 0; i < numberOfStops; i++) {
      // Get arrival 
      var stop = data.corsa.fermate.fermata[i].rif;

      // Get timing
      var programmaticTime = data.corsa.fermate.fermata[i].PP;
      var registeredTime = data.corsa.fermate.fermata[i].PR;

      if (registeredTime != "null") {
        time = convertTime(programmaticTime) + " - " + convertTime(registeredTime);
      } else {
        time = convertTime(programmaticTime);

        // Sets global variable with last stop in order to select on menu
        if (lastStop == null) {
          lastStop = i;
        }
      }

      // Add to menu items array
      items.push({
        title: stop,
        subtitle: time
      });
    }
  }

  // Finally return whole array
  return items;
};

/**
 * Fetches palinas around the given position
 * @param {Float} latitude the latitude
 * @param {Float} longitude the longitude
 * @param {Float} radius the radius of the are to fetch
 */
function fetchPalinas(latitude, longitude, radius) {
  var firstLatitude = latitude - radius;
  var firstLongitude = longitude - radius;
  var secondLatitude = latitude + radius;
  var secondLongitude = longitude + radius;

  var requestURL = generatePalinasURL(firstLatitude, firstLongitude, secondLatitude, secondLongitude, 20);
  //console.log("Makes request to: " + requestURL);
  // Make the request
  ajax(
    {
      url: requestURL,
      type: 'xml'
    },
    function(data) {
      // Success!
      //console.log('Success fetching palinas data');
      //console.log(data);
      var jsonData = xml2json.xml_str2json(data);

      // Create an array of Menu items
      var menuItems = parsePalinas(jsonData);
  
      // Construct Menu to show to user
      var palinasMenu = new UI.Menu({
        sections: [{
          title: 'Nearest palinas',
          items: menuItems
        }]
      });

      // Register for 'tap' events
      palinasMenu.on('accelTap', function(e) {
        // Removes old menu 
        palinasMenu.hide()
        // and fetches the new one
        fetchPalinas(latitude, longitude, radius);
      });
      
      // On row selection
      palinasMenu.on('select', function(e) {
        //console.log('Selected item #' + e.itemIndex + ' of section #' + e.sectionIndex);
        //console.log('The item is titled "' + e.item.title + '"');

        // Fetch routes for palina
        if (Object.prototype.toString.call(jsonData.paline.palina) === '[object Array]' ) {
          fetchRoutes(jsonData.paline.palina[e.itemIndex].codicePalina, jsonData.paline.palina[e.itemIndex].nomePalina);
        } else {
          fetchRoutes(jsonData.paline.palina.codicePalina, jsonData.paline.palina.nomePalina);
        }
      });
      
      //console.log(menuItems.length);
      if (menuItems.length == 0) {
        errorCard.body("No palinas found!");
        errorCard.show();  
      } else {
        // Show the menu
        palinasMenu.show();
      }
    },
    function(error) {
      // Failure!
      var errorMessage = 'Failed fetching palinas data: ' + error;
      console.error(errorMessage);

      errorCard.body(errorMessage);
      errorCard.show();
    }
  );
}

/**
 * Fetches routes passing in the given palina
 * @param {String} code the palina code 
 * @param {String} name the palina name 
 */
function fetchRoutes(code, name) {
  var requestURL = generateRoutesURL(code);
  //console.log("Makes request to: " + requestURL);
  // Make the request
  ajax(
    {
      url: requestURL,
      type: 'xml'
    },
    function(data) {
      // Success!
      //console.log('Success fetching routes data');
      //console.log(data);
      var jsonData = xml2json.xml_str2json(data);

      // Create an array of Menu items
      var menuItems = parseRoutes(jsonData);
  
      // Construct Menu to show to user
      var routesMenu = new UI.Menu({
        sections: [{
          title: 'Current routes of ' + name,
          items: menuItems
        }]
      });

      // Register for 'tap' events
      routesMenu.on('accelTap', function(e) {
        // Removes old menu 
        routesMenu.hide()
        // and fetches the new one
        fetchRoutes(code, name);
      });
      
      routesMenu.on('select', function(e) {
        //console.log('Selected item #' + e.itemIndex + ' of section #' + e.sectionIndex);
        //console.log('The item is titled "' + e.item.title + '"');

        // Fetch stops for route
        if (Object.prototype.toString.call(jsonData.transiti.corsa) === '[object Array]' ) {
          fetchLiveStops(jsonData.transiti.corsa[e.itemIndex].idCorsa, jsonData.transiti.corsa[e.itemIndex].automezzo);
        } else {
          fetchLiveStops(jsonData.transiti.corsa.idCorsa, jsonData.transiti.corsa.automezzo);
        }
      });
  
      if (menuItems.length == 0) {
        errorCard.body("No routes found!");
        errorCard.show();  
      } else {
        // Show the Menu, hide the splash
        routesMenu.show();
      }
    },
    function(error) {
      // Failure!
      var errorMessage = 'Failed fetching routes data: ' + error;
      console.error(errorMessage);

      errorCard.body(errorMessage);
      errorCard.show();
    }
  );
};

/**
 * Fetches live stops of the given route
 * @param {Number} routeCode the code of the route
 * @param {String} bus the bus code 
 */
function fetchLiveStops(routeCode, bus) {
  var requestURL = generateStopsURL(routeCode);
  //console.log("Makes request to: " + requestURL);
  // Make the request
  ajax(
    {
      url: requestURL,
      type: 'xml'
    },
    function(data) {
      // Success!
      //console.log('Success fetching stops data');
      //console.log(data);
      var jsonData = xml2json.xml_str2json(data);

      lastStop = null;
      // Create an array of Menu items
      var menuItems = parseStops(jsonData);
  
      // Construct Menu to show to user
      var stopsMenu = new UI.Menu({
        sections: [{
          title: 'Live stops of bus ' + bus ,
          items: menuItems
        }]
      });

      // Register for 'tap' events
      stopsMenu.on('accelTap', function(e) {
        // Removes old menu 
        stopsMenu.hide()
        // and fetches the new one
        fetchLiveStops(routeCode, bus);
      });
      
      if (menuItems.length == 0) {
        errorCard.body("No live stops found!");
        errorCard.show();  
      } else {
        // Show the Menu, hide the splash
        stopsMenu.show();

        // Select last stop
        if (lastStop != null) {
          stopsMenu.selection(0, lastStop);
          lastStop = null;
        }
      }
    },
    function(error) {
      // Failure!
      var errorMessage = 'Failed fetching stops data: ' + error;
      console.error(errorMessage);

      errorCard.body(errorMessage);
      errorCard.show();
    }
  );
}

/**
* MAIN PROGRAM
*/

// Prepare the accelerometer
Accel.init();

// Create a Card with title and subtitle
var mainCard = new UI.Card({
  title:'Cotral',
  body:'Shake in order to get palinas around you'
});

// Create an error Card with title and subtitle
var errorCard = new UI.Card({
  title:'Cotral',
  subtitle:'Error'
});

// Display the Card
mainCard.show();

// Register for 'tap' events
mainCard.on('accelTap', function(e) {
  fetchPalinasFromCurrentPosition(0.002);
});

// Gets palinas from current position
fetchPalinasFromCurrentPosition(0.002);