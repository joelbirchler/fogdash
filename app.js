var express = require('express'),
  app = express(),
  server = require('http').createServer(app),
  io = require('socket.io').listen(server),
  path = require('path'),
  _ = require('underscore'),
  fogbugz = require('./fogbugz.js'),
  config = require('./config.json');
  
  
//
// Configuration
//

app.configure(function() {
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.enable('trust proxy');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});


//
// Express routes
//

app.get('/', function(req, res){
  res.render('index', { chartStates: config.chartStates });
});


//
// Socket.io
//

var stats = {},
  currentMilestone;

var emitStats = function() {
  stats && io.sockets.emit('stats', stats);
}

var emitCurrentMilestone = function() {
  currentMilestone && io.sockets.emit('milestone', currentMilestone);
}

io.sockets.on('connection', function (socket) {
  emitCurrentMilestone();
  emitStats();
});

//
// FogBugz polling
//

var fetchStats = function() {
  fogbugz.fetchMilestones(function(err, milestones) {
    if (err) {
      console.error(err);
    } else {
      var now = new Date();
      var latestMilestone = _.find(milestones, function(milestone) {
        if (!milestone.endDate || !milestone.startDate) return false;
        var endDate = milestone.endDate;
        endDate.setHours(23);
        endDate.setMinutes(59);
        return (endDate > now) && (milestone.startDate < now);
      });
      
      if (latestMilestone) {
        if (currentMilestone != latestMilestone) {
          currentMilestone = latestMilestone;
          emitCurrentMilestone();
        }
        
        fogbugz.fetchCases(currentMilestone, function(err, cases) {
          var latestStats = fogbugz.stats(currentMilestone, cases);

          if (!_.isEqual(latestStats, stats)) {
            stats = latestStats;
            emitStats();
          }
        });
      }
    }
  });
}

setInterval(
  fetchStats, 
  config.pollSeconds * 1000
);


//
// Kick it off
//

fetchStats();

server.listen(app.get('port'), function() {
  console.log("Express server listening on port " + app.get('port'));
});
