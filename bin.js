#!/usr/bin/env node

var minimist = require('minimist')
var level = require('level')
var hyperlog = require('hyperlog')
var argv = minimist(process.argv.slice(2))

var log = hyperlog(level((argv.path || '.')+'/hyperlog'))


var add = function(cmd) {

}

var sync = function(path) {
  var remote = hyperlog(level(path+'/hyperlog')).replicate()
  console.log('fetching changes ...')
  remote.pipe(log.replicate()).pipe(remote).on('finish', function() {
    console.log('resolving deltas ...')
    log.resolve()
  })
}

var print = function() {
  log.changes({reverse:true}).on('data', function(node) {
    console.log('key   : %s', node.key)
    console.log('value : %s', node.value.toString())

    var indent = 'links : '
    node.links.forEach(function(ln) {
      console.log(indent+ln)
      indent = indent.replace(/./g, ' ')
    })

    console.log()
  })
}

var heads = function() {
  log.heads().on('data', function(head) {
    console.log(head)
  })
}

switch (argv._[0]) {
  case 'add':
  log.heads(function(err, nodes) {
    if (err) throw err
    log.add(nodes, argv._.slice(1).join(' ') || '(no value)')
  })
  return

  case 'sync':
  sync(argv._[1])
  return

  case 'print':
  print()
  return

  case 'heads':
  heads()
  return
}

console.log('Unknown command: %s', argv._[0])