# Patch Python 3.14 compatibility for django.template.context.BaseContext.__copy__
try:
    import django.template.context as _context

    def _base_context_copy(self):
        duplicate = self.__class__.__new__(self.__class__)
        duplicate.__dict__.update(self.__dict__)
        duplicate.dicts = self.dicts[:]
        return duplicate

    _context.BaseContext.__copy__ = _base_context_copy
except Exception:
    pass
