route=build-a-shell-in-haskell
title=Build your own shell using Haskell - Getting started
date=2022-07-24

---

Shell is a program that takes commands from the keyboard and gives them to operating system to perform. by building a shell you can better understand how the shell, terminal emulator and OS work together.

## Start

The simplest possible shell in haskell is only two lines of code.
`getLine` function blocks until user presses enter key and it returns the entire user input. Here we take it and name it as line. then on second line `callProcess` function from process library calls.

```haskell
main :: IO ()
main = do
  line <- getLine
  callProcess line []
```

After running you can see terminal waiting for your input.
try typing ls and pressing enter, and you will see result of ls command print out and the shell exits.

## Accepting Multiple Commands

We don’t want our shell to exit after the user enters a single command. we can continue asking for input and running the command by recursivly calling same function again.

```haskell
main :: IO ()
main = do
  line <- getLine
  callProcess line []
  main
```

and add a prompt.

```haskell
main :: IO ()
main = do
  putStr "> "
  hFlush stdout
  line <- getLine
  callProcess line []
  main
```

or another way that is more obvious that we're looping using another local function called go or loop

```haskell
main :: IO ()
main = loop
  where
    loop :: IO ()
    loop = do
      putStr "> "
      hFlush stdout
      line <- getLine
      callProcess line []
      loop
```

or we can use `forever` function:

```haskell
main :: IO ()
main = forever $ do
  putStr "> "
  hFlush stdout
  line <- getLine
  callProcess line []
```

try it with commands like `ls` and `pwd`.

`hFlush` makes sure that stdout before that is printed before waiting for user input.

## Handling Args

Our program till now accepts commands but cant handle args to the commands. for example if you run command `ls -a`, it will crash.

```haskell
loop :: IO ()
loop = do
  putStr "> "
  hFlush stdout
  line <- getLine
  let parts = words line
  let command = head parts
  let args = tail parts
  callProcess command args
  loop
```

## Shell Built-ins

There are certain commands you can't just dispatch to another process. `cd` command is a example of that (check out [this link](https://unix.stackexchange.com/questions/38808/why-is-cd-not-a-program/38809#38809) to see why cd is not another process).

```haskell
-- snip
let args = tail parts

case command of
  "cd" -> do
    path <- case args of
      []         -> getHomeDirectory
      (path : _) -> pure path

    setCurrentDirectory path
  _ -> do
    callProcess command args
loop
```

## Refactor and error handling

Let's refactor the code base a little bit. There are three things that main function does.

- show prompt and get input
- parse the input
- run the action

I'm gonna take out each functionaliy from loop and make a new function for it and add new data type for parsed action.

```haskell
prompt :: IO Text
prompt = do
  TIO.putStr "> "
  hFlush stdout
  TIO.getLine

data Action = Command Text [Text]

parseCommand :: Text -> Maybe Action
parseCommand line
  = case T.words line of
     []           -> Nothing
     (cmd : args) -> Just $ Command cmd args

runAction :: Action -> IO ()
runAction (Command cmd args) = do
  case cmd of
    "cd" -> do
      path <- case args of
        []         -> getHomeDirectory
        (path : _) -> pure path
      setCurrentDirectory path
    _ -> callProcess cmd args

main :: IO ()
main = forever $ do
  line <- prompt
  case parseCommand line of
    Nothing -> hPutStrLn stderr "parsing error"
    Just action -> runAction action `catch` \(e :: SomeException) -> hPutStrLn stderr (show e)
```

`catch` function catches any exception that runAction possibly can throw and prints it to stderr so that this loop never exits.

## Adding pipes

It would be difficult to be productive in a shell which didn’t include pipes. If you aren’t familiar with this feature, the | character is used to tell the shell to redirect the output of the first command into the input of the second command. For example, running the command `ls | grep Cabal` triggers the following set of actions:

1. ls will list all files in the current directory
2. The shell will pipe the above list of files to grep
3. grep will filter the list and output only files which contain the string Cabal

For an introduction to many other things pipes and IO redirection can do, check out [this article](https://thoughtbot.com/blog/input-output-redirection-in-the-shell).

```haskell
-- snip

data Action
  = Command Text [Text]
  | Pipe Action Action

parseAction :: Text -> Maybe Action
parseAction line = do
  actions <- traverse parseCommand . T.splitOn "|" $ line
  case actions of
    []  -> Nothing
    [a] -> pure a
    (a : as) -> do
      pure $ foldl Pipe a as

runAction :: Handle -> Handle -> Action -> IO ()
runAction input output (Command cmd args) = do
  case cmd of
    "cd" -> do
      path <- case args of
        []         -> getHomeDirectory
        (path : _) -> pure (T.unpack path)
      setCurrentDirectory path
    _ -> do
      -- Create new CreateProcess with stdin and stdout handles from arguments
      let process = (P.proc (T.unpack cmd) (map T.unpack args)) { std_out = UseHandle output, std_in = UseHandle input }
      (_, _, _, h) <- createProcess process
      exitCode <- waitForProcess h
      pure ()

runAction input output (Pipe from to) = do
  (reader, writer) <- createPipe
  -- runs first action with writer as stdout
  runAction input writer from
  -- runs second action with reader as stdin
  runAction reader output to

main :: IO ()
main = forever $ do
  line <- prompt
  case parseCommand line of
    Nothing -> hPutStrLn stderr "parsing error"
    Just action -> runAction stdin stdout action `catch`
                      \(e :: SomeException) -> hPutStrLn stderr (show e)
```

`createPipe` is for interprocess communication, returns two handles one can be used to write (`writer`) and one to read (`reader`). Here I'm using writer as handle of output of first program and reader as input of second program. By using `createPipe`, we can even run two actions concurrently.

## Conclusion

This is whole program till here.

```haskell
{-# LANGUAGE OverloadedStrings #-}
module Main where

import           Control.Exception ( SomeException, catch )
import           Control.Monad     ( forever )
import           Data.Text         ( Text )
import qualified Data.Text         as T
import qualified Data.Text.IO      as TIO
import           System.Directory  ( getCurrentDirectory, getHomeDirectory, setCurrentDirectory )
import           System.IO         ( Handle, hFlush, hPutStr, hPutStrLn, stderr, stdin, stdout )
import           System.Process
    ( CreateProcess (..), StdStream (..), createPipe, createProcess, waitForProcess )
import qualified System.Process    as P

prompt :: IO Text
prompt = do
  currDir <- getCurrentDirectory
  putStr $ currDir <> " > "
  hFlush stdout
  TIO.getLine

parseCommand :: Text -> Maybe Action
parseCommand line
  = case T.words line of
     []           -> Nothing
     (cmd : args) -> Just $ Command cmd args

data Action
  = Command Text [Text]
  | Pipe Action Action

parseAction :: Text -> Maybe Action
parseAction line = do
  actions <- traverse parseCommand . T.splitOn "|" $ line
  case actions of
    []  -> Nothing
    [a] -> pure a
    (a : as) -> do
      pure $ foldl Pipe a as

runAction :: Handle -> Handle -> Action -> IO ()
runAction input output (Command cmd args) = do
  case cmd of
    "cd" -> do
      path <- case args of
        []         -> getHomeDirectory
        (path : _) -> pure (T.unpack path)
      setCurrentDirectory path
    _ -> do
      let process = (P.proc (T.unpack cmd) (map T.unpack args)) { std_out = UseHandle output, std_in = UseHandle input }
      (_, _, _, h) <- createProcess process
      exitCode <- waitForProcess h
      pure ()

runAction input output (Pipe from to) = do
  (reader, writer) <- createPipe
  runAction input writer from
  runAction reader output to

main :: IO ()
main = forever $ do
  line <- prompt
  case parseCommand line of
    Nothing -> hPutStrLn stderr "parsing error"
    Just action -> runAction stdin stdout action `catch`
                      \(e :: SomeException) -> hPutStrLn stderr (show e)
```

Source code is available on github in [this link](https://github.com/jedimahdi/lazysh).

Thanks to Josh Mcguigan for [this blog post](https://www.joshmcguigan.com/blog/build-your-own-shell-rust/).
