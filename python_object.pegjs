start = map / list / tuple / const

const = 'hello'

map = '{' ( keyval (',' keyval) * ) ? '}'

keyval = const ':' start

list = '[' ( start (',' start) * ) ? ']'

tuple = '(' ( start (',' start) * ) ? ')'


