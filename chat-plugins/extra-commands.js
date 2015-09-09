/*****************
* Extra Commands *
*****************/

var fs = require('fs');
var http = require('http');
var urbanCache = {};
var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var regdateCache = {};

try {
	regdateCache = JSON.parse(fs.readFileSync('config/regdatecache.json', 'utf8'));
} catch (e) {}

try {
	urbanCache = JSON.parse(fs.readFileSync('config/udcache.json', 'utf8'));
} catch (e) {}

function cacheUrbanWord (word, definition) {
	if (word.toString().length < 1) return;
	word = word.toLowerCase().replace(/ /g, '');
	urbanCache[word] = {"definition": definition, "time": Date.now()};
	fs.writeFile('config/urbancache.json', JSON.stringify(urbanCache));
}

function cacheRegdate (name, date) {
	regdateCache[toId(name)] = date;
	fs.writeFileSync('config/regdatecache.json', JSON.stringify(regdateCache));
}

exports.commands = {
	urand: 'ud',
	udrand: 'ud',
	u: 'ud',
	ud: function(target, room, user, connection, cmd) {
		var random = false;
		if (!target) {
			target = '';
			random = true;
		}
		if (target.toString().length > 50) return this.sendReply('/ud - <phrase> can not be longer than 50 characters.');
		if (!this.canBroadcast()) return;

		var options;
		if (!random) {
			options = {
			    host: 'api.urbandictionary.com',
			    port: 80,
			    path: '/v0/define?term=' + encodeURIComponent(target)
			};
		} else {
			options = {
			    host: 'api.urbandictionary.com',
			    port: 80,
			    path: '/v0/random',
			};
		}

		var milliseconds = ((44640 * 60) * 1000);

		if (urbanCache[target.toLowerCase().replace(/ /g, '')] && Math.round(Math.abs((urbanCache[target.toLowerCase().replace(/ /g, '')].time - Date.now())/(24*60*60*1000))) < 31) {
			return this.sendReplyBox("<b>" + Tools.escapeHTML(target) + ":</b> " + urbanCache[target.toLowerCase().replace(/ /g, '')].definition.substr(0,400));
		}

		var self = this;

		var req = http.get(options, function(res) {
			res.setEncoding('utf8');
			if (res.statusCode !== 200) {
				self.sendReplyBox('No results for <b>"' + Tools.escapeHTML(target) + '"</b>.');
				return room.update();
			}
			var data = '';

			res.on('data', function (chunk) {
				console.log('BODY: ' + chunk);
				data += chunk;
			});

			res.on('end', function () {
				var page = JSON.parse(data);
				if (page['result_type'] === 'no_results') {
		        	self.sendReplyBox('No results for <b>"' + Tools.escapeHTML(target) + '"</b>.');
		        	return room.update();
		        }

				var definitions = page['list'];
				var output = '<b>' + Tools.escapeHTML(definitions[0]['word']) + ':</b> ' + Tools.escapeHTML(definitions[0]['definition']).replace(/\r\n/g, '<br />').replace(/\n/g, ' ');
				if (output.length > 400) output = output.slice(0,400) + '...';
				cacheUrbanWord(definitions[0]['word'], Tools.escapeHTML(definitions[0]['definition']).replace(/\r\n/g, '<br />').replace(/\n/g, ' '));
				self.sendReplyBox(output);
				return room.update();
			});
		});

		req.on('error', function(e) {
			console.log('/u error: ' + e.message);
		});
		req.end();
	},

	def: 'define',
	define: function(target, room, user) {
		if (!target) return this.sendReply('Usage: /define <word>');
		target = toId(target);
		if (target > 50) return this.sendReply('/define <word> - word can not be longer than 50 characters.');
		if (!this.canBroadcast()) return;
		var options = {
			host: 'api.wordnik.com',
			port: 80,
			path: '/v4/word.json/' + encodeURIComponent(target) + '/definitions?limit=3&sourceDictionaries=all' +
		    '&useCanonical=false&includeTags=false&api_key=a2a73e7b926c924fad7001ca3111acd55af2ffabf50eb4ae5'
		};

		var self = this;

		var req = http.get(options, function(res) {
			res.setEncoding('utf8');
		    if (res.statusCode !== 200) {
		    	self.sendReplyBox("No results for <b>\"" + Tools.escapeHTML(target) + "\"</b>.");
		    	return room.update();
		    }

			var data = '';

			res.on('data', function (chunk) {
				//console.log('BODY: ' + chunk);
				data += chunk;
			});

			res.on('end', function () {
		        var page = JSON.parse(data);
		        var output = '<font color=#24678d><b>Definitions for ' + target + ':</b></font><br />';
		        if (!page[0]) {
		        	self.sendReplyBox('No results for <b>"' + target + '"</b>.');
		        	return room.update();
		        } else {
		        	var count = 1;
		        	for (var u in page) {
		        		if (count > 3) break;
		        		output += '(<b>' + count + '</b>) ' + Tools.escapeHTML(page[u]['text']) + '<br />';
		        		count++;
		        	}
		        	self.sendReplyBox(output);
		        	return room.update();
		        }
		    });
		});
		req.end();
	},

	regdate: function(target, room, user, connection) {
		if (!this.canBroadcast()) return;
		if (!target || toId(target).length < 1 || toId(target).length > 19) target = toId(user.userid);
		if (regdateCache[toId(target)]) return this.sendReplyBox(Tools.escapeHTML(target) + " was registered on " + regdateCache[toId(target)]);
		var options = {
			host: 'pokemonshowdown.com',
			port: 80,
			path: '/users/' + encodeURIComponent(target) + '.json'
		};

		var self = this;

		var req = http.get(options, function(res) {
			res.setEncoding('utf8');

			var data = '';

			res.on('data', function (chunk) {
				//console.log('BODY: ' + chunk);
				data += chunk;
			});

			res.on('end', function () {
		        var json = JSON.parse(data);
		        console.log('json: ' + JSON.stringify(json));
		        if (json.registertime === 0) {
		        	self.sendReplyBox(Tools.escapeHTML(target) + " is not registered.");
		      		return room.update();
		        }

		        var date = json.registertime.toString();
		        while (date.length < 13) date += "0";
		        date = new Date(Number(date));

		        self.sendReplyBox(Tools.escapeHTML(target) + " was registered on " + monthNames[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear());
		        cacheRegdate(toId(target), monthNames[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear());
		        return room.update();
		    });
		});
		req.end();
	}
}
