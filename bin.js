#!/usr/bin/env node

var minimist = require('minimist')
var level = require('level')
var hyperlog = require('hyperlog')
var proc = require('child_process')
var http = require('http')
var https = require('https')
var duplexify = require('duplexify')
var url = require('url')
var stdout = require('single-line-log').stdout
var argv = minimist(process.argv.slice(2))

var DEFAULT_PORT = 6556

var log = hyperlog(level((argv.path || '.')+'/hyperlog'))

var spawn = function(path) {
  if (/https?:/.test(path)) {
    var p = url.parse(path)
    var req = (p.protocol === 'https' ? https : http).request({method: 'POST', port: p.port || DEFAULT_PORT, host: p.host})
    var proxy = duplexify()

    req.on('response', function (res) {
      proxy.setReadable(res)
      proxy.setWritable(false)
    })

    return {stdin: req, stdout: proxy}
  }
  if (path.indexOf('@') > -1) {
    var start = path.split(':')[0]
    var end = path.split(':')[1]
    return proc.spawn('ssh', ['-o', 'UserKnownHostsFile=/dev/null', '-o', 'StrictHostKeyChecking=no', start, 'hyperlog replicator --path '+end])
  }
  return proc.spawn('hyperlog', ['replicator', '--path', path])
}

var pulled = 0
var pushed = 0

var replicate = function (mode) {
  var stream = log.replicate({mode: mode})
  if (argv.quiet || argv.q) return stream

  var print = function () {
    var msg = ''
    if (mode === 'pull' || mode === 'sync') msg += 'Pulled ' + pulled + ' nodes\n'
    if (mode === 'push' || mode === 'sync') msg += 'Pushed ' + pushed + ' nodes\n'
    stdout(msg)
  }

  stream.on('pull', function () {
    pulled++
    print()
  })

  stream.on('push', function () {
    pushed++
    print()
  })

  print()

  return stream
}

var sync = function (path) {
  var remote = spawn(path)
  remote.stdout.pipe(replicate('sync')).pipe(remote.stdin)
}

var pull = function (path) {
  var remote = spawn(path)
  remote.stdout.pipe(replicate('pull')).pipe(remote.stdin)
}

var push = function (path) {
  var remote = spawn(path)
  remote.stdout.pipe(replicate('push')).pipe(remote.stdin)
}

var onnode = function(node) {
  console.log('key   : %s', node.key)
  console.log('value : %s', node.value.toString())

  var indent = 'links : '
  node.links.forEach(function(ln) {
    console.log(indent+ln)
    indent = indent.replace(/./g, ' ')
  })

  console.log()
}

var print = function() {
  log.createReadStream({reverse:true}).on('data', onnode)
}

var heads = function() {
  log.heads().on('data', function(head) {
    console.log(head.key)
  })
}

switch (argv._[0]) {
  case 'get':
  log.get(argv._[1], function (err, node) {
    if (err) throw err
    onnode(node)
  })
  return

  case 'add':
  log.add(argv.link || argv.l, argv.value || argv.v || '(no value)', function (err, node) {
    if (err) throw err
    onnode(node)
  })
  return

  case 'server':
  var server = http.createServer(function (req, res) {
    req.pipe(replicate('sync')).pipe(res)
  })

  server.listen(argv.port || 6556, function () {
    console.log('Server is listening on port %d', server.address().port)
  })
  return

  case 'replicator':
  process.stdin.pipe(log.replicate()).pipe(process.stdout)
  return

  case 'sync':
  sync(argv._[1])
  return

  case 'pull':
  pull(argv._[1])
  return

  case 'push':
  push(argv._[1])
  return

  case 'heads':
  heads()
  return
}

print()
