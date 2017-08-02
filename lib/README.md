Tokenizer library
=================

This is an XML tokenizer library for `cxml`, written in C++ for speed.
Fundamentally it's a small, manually designed DFA (state machine).

Every recognized element or attribute from a known namespace is a specific
token. Otherwise tokens are different kinds of offsets to the input buffer.

Structure
---------

- `Parser.cc` contains the main state machine.
- `PatriciaCursor.cc` handles traversing Patricia tries containing known
  text string tokens.
- `ParserConfig.h` contains the API for initializing parser settings.
  Creating new parser instances from the same config object is fast.

Design
------

### What choices make C++ suitable and why is it faster?

Some reasons:

- The code would be almost the same if written in JavaScript, but a
  JavaScript JIT compiler would need to make countless correct guesses
  to produce equally optimized output.
  - The state machine structure is encoded in assignments to an integer
    `state` variable and `switch`, `case` and `goto` statements.
    An integer-based jump table is very fast.
  - Every `goto` could be replaced with `continue`, but then the compiler
    may not understand that the jump table can be skipped.
- Length of text content is calculated in a very tight loop using a pointer.
  Compiled JavaScript would require more safety checks.
- Output is only tokens with offsets to input, nothing is copied.
- Input is treated as bytes without decoding UTF-8.
  Recognized tokens never need such decoding.
- Calls between languages are always slow and thus only used to notify when
  a buffer has become full. No arguments are passed, to avoid type conversion.
  - Both languages directly access the same buffers, sharing memory.
- Code dealing with pointers and character literals is clearer and less
  verbose when written in C++.

### Counter-arguments and justifications for C++

- For safety, C++ does require more careful programming, especially when
  using pointers.
  - Incorrect memory reads in C++ could crash when JavaScript would produce
    invalid output, allowing denial of service attacks. Information from other
    variables could also be leaked.
  - Invalid memory writes through pointers lead to remote code execution
    exploits, compromising all security.
    - They should be avoided, or audited carefully and surrounded with checks.
- For speed, this tokenizer uses pointers extensively but carefully.
  - When reading, it avoids many run-time checks that JavaScript would do.
    - However, it does not output what was read, only where it found something
      interesting. This avoids leaking information.
  - Writes are done very carefully in a single, small function.
    - Between various checks, only one number is written at a time.
    - Elsewhere, `const` pointers prevent accidental memory writes.
    - Written data is not directly copied from input.
