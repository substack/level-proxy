# level-swap

proxy a leveldb reference so you can swap backend instances on the fly

This is useful for modules that need to switch out references transparently,
like automatically upgrading an ordinary vanilla reference into a multilevel
handle. You could probably also use this module to implement even crazier
things, like a transparent hash ring.

# example


