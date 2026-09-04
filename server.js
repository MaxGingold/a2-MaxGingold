const http = require( 'http' ),
      fs   = require( 'fs' ),
      // IMPORTANT: you must run `npm install` in the directory for this assignment
      // to install the mime library if you're testing this on your local machine.
      // On Render, make sure `npm install` is your build command.
      mime = require( 'mime' ),
      dir  = 'public/',
      port = 3000

// The dataset. Held in memory, so it resets every time the server restarts.
let scores = []
let nextId = 1

// Adds a field derived from fields already on the row: hits per second.
// Called before a new row is added to `scores`.
const addDerived = function( row ) {
  row.hitsPerSecond = row.durationSeconds > 0
    ? Math.round( ( row.hits / row.durationSeconds ) * 100 ) / 100
    : 0

  return row
}

// The scores sorted highest-hits-first - the shape every API response returns.
const ranked = function() {
  return scores.slice().sort( ( a, b ) => b.hits - a.hits )
}

// Send a JSON response with the given status code.
const sendJSON = function( response, status, data ) {
  response.writeHead( status, { 'Content-Type': 'application/json' })
  response.end( JSON.stringify( data ) )
}

const server = http.createServer( function( request, response ) {
  if( request.method === 'GET' ) {
    handleGet( request, response )
  }else if( request.method === 'POST' ) {
    handlePost( request, response )
  }else if( request.method === 'PATCH' ) {
    handlePatch( request, response )
  }else if( request.method === 'DELETE' ) {
    handleDelete( request, response )
  }
})

const handleGet = function( request, response ) {
  const filename = dir + request.url.slice( 1 )

  if( request.url === '/api/scores' ) {
    sendJSON( response, 200, ranked() )
  }else if( request.url === '/' ) {
    sendFile( response, 'public/index.html' )
  }else{
    sendFile( response, filename )
  }
}

const handlePost = function( request, response ) {
  let dataString = ''

  request.on( 'data', function( data ) {
    dataString += data
  })

  request.on( 'end', function() {
    let data
    try {
      data = JSON.parse( dataString )
    }catch( err ) {
      return sendJSON( response, 400, { error: 'Bad JSON' })
    }

    // check the incoming fields
    const name = typeof data.name === 'string' ? data.name.trim() : ''
    const hits = Number( data.hits )

    if( name === '' || !Number.isInteger( hits ) || hits < 0 ) {
      return sendJSON( response, 400, { error: 'Bad data' })
    }

    const duration = Number( data.durationSeconds ) > 0 ? Number( data.durationSeconds ) : 30

    // build the row, add the derived field, store it
    scores.push( addDerived({
      id: nextId++,
      name: name,
      hits: hits,
      durationSeconds: duration
    }) )

    sendJSON( response, 200, ranked() )
  })
}

const handlePatch = function( request, response ) {
  let dataString = ''

  request.on( 'data', function( data ) {
    dataString += data
  })

  request.on( 'end', function() {
    const id  = Number( request.url.split( '/' ).pop() )
    const row = scores.find( score => score.id === id )

    let data
    try {
      data = JSON.parse( dataString )
    }catch( err ) {
      return sendJSON( response, 400, { error: 'Bad JSON' })
    }

    const name = typeof data.name === 'string' ? data.name.trim() : ''

    if( row === undefined ) {
      sendJSON( response, 404, { error: 'Not found' })
    }else if( name === '' ) {
      sendJSON( response, 400, { error: 'Bad data' })
    }else{
      row.name = name
      sendJSON( response, 200, ranked() )
    }
  })
}

const handleDelete = function( request, response ) {
  const id  = Number( request.url.split( '/' ).pop() )
  const row = scores.find( score => score.id === id )

  if( row === undefined ) {
    sendJSON( response, 404, { error: 'Not found' })
  }else{
    scores = scores.filter( score => score.id !== id )
    sendJSON( response, 200, ranked() )
  }
}

const sendFile = function( response, filename ) {
   const type = mime.getType( filename )

   fs.readFile( filename, function( err, content ) {

     // if the error = null, then we've loaded the file successfully
     if( err === null ) {

       // status code: https://httpstatuses.com
       response.writeHeader( 200, { 'Content-Type': type })
       response.end( content )

     }else{

       // file not found, error code 404
       response.writeHeader( 404 )
       response.end( '404 Error: File Not Found' )

     }
   })
}

server.listen( process.env.PORT || port )
