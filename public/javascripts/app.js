(function() {
  
  var socket = io.connect('http://localhost');
  socket.on('stats', function (data) {
    console.log(data);
  });
  
})();