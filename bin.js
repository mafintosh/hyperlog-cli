#!/usr/bin/env node

var minimist = require('minimist')
var level = require('level')
var hyperlog = require('hyperlog')
var proc = require('child_process')
var argv = minimist(process.argv.slice(2))

var log = hyperlog(level((argv.path || '.')+'/hyperlog'))

var spawn = function(path) {
  if (path.indexOf('@') > -1) {
    var start = path.split(':')[0]
    var end = path.split(':')[1]
    return proc.spawn('ssh', ['-o', 'UserKnownHostsFile=/dev/null', '-o', 'StrictHostKeyChecking=no', start, 'hyperlog sync --path '+end])
  }
  return proc.spawn('hyperlog', ['sync', '--path', path])
}

var pull = function(path) {
  var remote = spawn(path)
  remote.stdout.pipe(log.createReplicationStream({mode: 'pull'})).pipe(remote.stdin)
}

var push = function(path) {
  var remote = spawn(path)
  remote.stdout.pipe(log.createReplicationStream({mode: 'push'})).pipe(remote.stdin)
}

var onnode = function(node) {
  console.log('hash  : %s', node.hash)
  console.log('value : %s', node.value.toString())

  var indent = 'links : '
  node.links.forEach(function(ln) {
    console.log(indent+ln.hash)
    indent = indent.replace(/./g, ' ')
  })

  console.log()
}

var print = function() {
  log.createChangesStream({reverse:true}).on('data', onnode)
}

var heads = function() {
  log.heads().on('data', function(head) {
    console.log(head.hash)
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

  case 'sync':
  process.stdin.pipe(log.createReplicationStream()).pipe(process.stdout)
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
