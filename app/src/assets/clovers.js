import BN from 'bignumber.js'
import cloverTokenArtifacts from '../../../build/contracts/CloverToken.json'
import contract from 'truffle-contract'
import Web3 from 'web3'
let web3 = window.web3

class Clover {

  constructor (startVal) {
    this.BOARDDIM = 8
    this.EMPTY = 0
    this.BLACK = 1
    this.WHITE = 2
    this.clearAttrs()
    if (startVal) {
      Object.assign(this, startVal)
    }
  }

  clearAttrs () {
    this.error = false
    this.complete = false
    this.symmetrical = false
    this.currentPlayer = this.BLACK
    // this.board is an array of columns, visually the board should be arranged by arrays of rows
    this.board = new Array(this.BOARDDIM).fill(0).map(c => new Array(this.BOARDDIM).fill(this.EMPTY))
    this.visualBoard = []
    this.board[(this.BOARDDIM / 2) - 1][(this.BOARDDIM / 2) - 1] = this.WHITE
    this.board[(this.BOARDDIM / 2)][(this.BOARDDIM / 2)] = this.WHITE
    this.board[(this.BOARDDIM / 2) - 1][(this.BOARDDIM / 2)] = this.BLACK
    this.board[(this.BOARDDIM / 2)][(this.BOARDDIM / 2) - 1] = this.BLACK
    this.moves = []
    this.byteBoard = ''
    this.byteFirst32Moves = ''
    this.byteLastMoves = ''
    this.moveKey = 0
    this.msg = ''
  }

  initWeb3 () {
    if (web3) {
      // Use Mist/MetaMask's provider
      var web3Provider = web3.currentProvider
    } else {
      // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
      // web3Provider = new Web3.providers.HttpProvider('https://mainnet.infura.io/Q5I7AA6unRLULsLTYd6d')
      web3Provider = new Web3.providers.HttpProvider('http://localhost:8545')
    }
    web3 = new Web3(web3Provider)
  }

  setContract () {
    this.CloverToken = contract(cloverTokenArtifacts)
    this.CloverToken.setProvider(web3.currentProvider)
  }

  playGameMovesArray (moves = []) {
    if (moves.length === 0) return
    this.clearAttrs()
    this.moves = moves
    this.thisMovesToByteMoves()
    let skip = false
    for (let i = 0; i < moves.length && !skip; i++) {
      this.moveKey++
      this.makeMove(this.moveToArray(moves[i]))
      if (this.error) {
        this.error = false
        this.currentPlayer = this.currentPlayer === this.BLACK ? this.WHITE : this.BLACK
        this.makeMove(this.moveToArray(moves[i]))
        if (this.error) {
          skip = true
        }
      }
    }
    this.thisBoardToByteBoard()
    if (!this.error) {
      this.isComplete()
      this.isSymmetrical()
    }
    this.makeVisualBoard()
  }

  playGameMovesString (moves = null) {
    this.playGameMovesArray(this.stringMovesToArrayMoves(moves))
  }

  makeMove (move) {
    let col = move[0]
    let row = move[1]
    if (this.board[col][row] !== this.EMPTY) {
      this.error = true
      this.msg = 'Invalid Game (square is already occupied)'
      return
    }
    let possibleDirections = this.possibleDirections(col, row)
    if (possibleDirections.length === 0) {
      this.error = true
      this.msg = 'Invalid Game (doesnt border other tiles)'
      return
    }
    let flipped = false
    for (let i = 0; i < possibleDirections.length; i++) {
      let possibleDirection = possibleDirections[i]
      let flips = this.traverseDirection(possibleDirection, col, row)
      for (let j = 0; j < flips.length; j ++) {
        flipped = true
        this.board[flips[j][0]][flips[j][1]] = this.currentPlayer
      }
    }
    if (flipped) {
      this.board[col][row] = this.currentPlayer
    } else {
      this.error = true
      this.msg = 'Invalid Game (doesnt flip any other tiles)'
      return
    }
    this.currentPlayer = this.currentPlayer === this.BLACK ? this.WHITE : this.BLACK
  }

  possibleDirections (col, row) {
    let dirs = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1]
    ]
    let possibleDirections = []
    for (let i = 0; i < dirs.length; i++) {
      let dir = dirs[i]
      let fooCol = col + dir[0]
      let fooRow = row + dir[1]
      if (!(fooCol > 7 || fooCol < 0 || fooRow > 7 || fooRow < 0)) {
        let fooTile = this.board[fooCol][fooRow]
        if (fooTile !== this.currentPlayer && fooTile !== this.EMPTY) {
          possibleDirections.push(dir)
        }
      }
    }
    return possibleDirections
  }

  traverseDirection (possibleDirection, col, row) {
    let flips = []
    let skip = false
    let opponentPlayer = this.currentPlayer === this.BLACK ? this.WHITE : this.BLACK
    for (let i = 1; i < (this.BOARDDIM + 1) && !skip; i++) {
      let fooCol = (i * possibleDirection[0]) + col
      let fooRow = (i * possibleDirection[1]) + row
      if (fooCol > 7 || fooCol < 0 || fooRow > 7 || fooRow < 0) {
        // ran off the board before hitting your own tile
        skip = true
        flips = []
      } else {
        let fooTile = this.board[fooCol][fooRow]
        if (fooTile === opponentPlayer) {
          // if tile is opposite color it could be flipped, so add to potential flip array
          flips.push([fooCol, fooRow])
        } else if (fooTile === this.currentPlayer && i > 1) {
          // hit current players tile which means capture is complete
          skip = true
        } else {
          // either hit current players own color before hitting an opponent's
          // or hit an empty space
          flips = []
          skip = true
        }
      }
    }
    return flips
  }

  isComplete () {
    if (this.moveKey === 60) {
      this.complete = true
      this.msg = 'good game'
      return
    }
    let empties = []
    for (let i = 0; i < this.BOARDDIM; i++) {
      for (let j = 0; j < this.BOARDDIM; j++) {
        if (this.board[i][j] === this.EMPTY) {
          empties.push([i, j])
        }
      }
    }
    let validMovesRemain = false
    if (empties.length) {
      for (i = 0; i < empties.length && !validMovesRemain; i++) {
        let gameCopy = new Clover(this)
        // Object.assign(gameCopy, JSON.parse(JSON.stringify(this)))
        gameCopy.currentPlayer = this.BLACK
        gameCopy.makeMove(empties[i])
        if (!gameCopy.error) {
          validMovesRemain = true
        }
        gameCopy = new Clover(this)
        // Object.assign(gameCopy, JSON.parse(JSON.stringify(this)))
        gameCopy.currentPlayer = this.WHITE
        gameCopy.makeMove(empties[i])
        if (!gameCopy.error) {
          validMovesRemain = true
        }
        gameCopy = undefined
      }
    } 
    if (validMovesRemain) {
      this.error = true
      this.msg = 'Invalid Game (moves still available)'
    } else {
      this.complete = true
      this.msg = 'good game'
    }
  }

  isSymmetrical () {
    let RotSym = true
    let Y0Sym = true
    let X0Sym = true
    let XYSym = true
    let XnYSym = true
    for (let i = 0; i < this.BOARDDIM && (RotSym || Y0Sym || X0Sym || XYSym || XnYSym); i++) {
      for (let j = 0; j < this.BOARDDIM && (RotSym || Y0Sym || X0Sym || XYSym || XnYSym); j++) {
        // rotational symmetry
        if (this.board[i][j] != this.board[(7 - i)][(7 - j)]) {
          RotSym = false
        }
        // symmetry on y = 0
        if (this.board[i][j] != this.board[i][(7 - j)]) {
          Y0Sym = false;
        }
        // symetry on x = 0
        if (this.board[i][j] != this.board[(7 - i)][j]) {
          X0Sym = false;
        }
        // symmetry on x = y
        if (this.board[i][j] != this.board[(7 - j)][(7 - i)]) {
          XYSym = false;
        }
        // symmetry on x = -y
        if (this.board[i][j] != this.board[j][i]) {
          XnYSym = false;
        }
      }
    }
    if (RotSym || Y0Sym || X0Sym || XYSym || XnYSym) {
      this.symmetrical = true
    }
  }

  makeVisualBoard () {
    this.visualBoard = this.arrayBoardToRows(this.board.map(c => (c.map(t => t === 1 ? 'b' : (t === 2 ? 'w' : '-'))).join('')).join('').match(/.{1,1}/g)).map((r) => {
      return r.map((t) =>  t === 'b' ? '⬛️' : (t === 'w' ? '⬜️' : '❎'))
    })
  }

  colArrayBoardToBinaryBoard (colArrayBoard = []) {
    if (!colArrayBoard.length) return
    let boardString = ''
    for (let col = 0; col < colArrayBoard.length; col++) {
      for (let row = 0; row < colArrayBoard[col].length; row++) {
        let tile = colArrayBoard[col][row]
        boardString += tile === this.BLACK ? '01' : (tile === this.WHITE ? '10' : '00')
      }
    }
    return boardString
  }

  colArrayBoardToByteBoard (colArrayBoard = []) {
    if (!colArrayBoard.length) return
    return this.binaryBoardToByteBoard(this.colArrayBoardToBinaryBoard(colArrayBoard))
  }

  binaryBoardToByteBoard (binaryBoard) {
    let foo = new BN(binaryBoard, 2)
    return foo.toString(16)
  }

  byteBoardToArrayBoard (byteBoard = 0) {
    byteBoard = new BN(byteBoard, 16)
    byteBoard = byteBoard.toString(2)
    let len = byteBoard.length
    if (len < 128) {
      let padding = 128 - len
      padding = new Array(padding)
      padding = padding.fill('0').join('')
      byteBoard = padding + byteBoard
    }
    return byteBoard.match(/.{1,2}/g).map((tile) => {
      return tile === '01' ? 'b' : (tile === '10' ? 'w' : '-')
    })
  }

  byteArrayToRowArray (byteBoard = 0) {
    return this.arrayBoardToRows(this.byteBoardToArrayBoard(byteBoard))
  }

  byteArrayToColArray (byteBoard = 0) {
    return this.arrayBoardToCols(this.byteBoardToArrayBoard(byteBoard))
  }

  arrayBoardToRows (arrayBoard = []) {
    let rowsArray = []
    for (let i = 0; i < 64; i++) {
      let row = i % 8
      if (!rowsArray[row]) rowsArray[row] = []
      rowsArray[row].push(arrayBoard[i])
    }
    return rowsArray
  }

  arrayBoardToCols (arrayBoard = []) {
    let colsArray = []
    for (let i = 0; i < 64; i++) {
      let col = Math.floor(i / 8)
      if (!colsArray[col]) colsArray[col] = []
      colsArray[col].push(arrayBoard[i])
    }
    return colsArray
  }

  stringBoardToArrayBoard (stringBoard = false) {
    return stringBoard && (stringBoard.match(/.{1,1}/g).map((spot) => {
      return spot === 'b' ? '01' : (spot === 'w' ? '10' : '00')
    }).join(''))
  }

  thisBoardToByteBoard () {
    this.byteBoard = this.colArrayBoardToByteBoard(this.board)
  }

  thisMovesToByteMoves (moves = this.moves) {
    moves = this.stringMovesToBinaryMoves(moves.join('')).match(/.{1,224}/g)
    let foo = new BN(moves[0], 2)
    let bar = new BN(moves[1], 2)
    this.byteFirst32Moves = foo.toString(16)
    this.byteLastMoves = bar.toString(16)
  }

  stringMovesToBinaryMoves (stringMoves = false) {
    if (!stringMoves) return
    stringMoves = stringMoves.match(/.{1,2}/g).map((move) => {
      if (move.length < 2) return
      let moveArray = move.match(/.{1,1}/g)
      let m = this.moveToArray(moveArray)
      let foo = new BN(m[0] + (m[1] * 8) + 64)
      return foo.toString(2)
    }).join('')
    if (stringMoves.length < (64 * 7)) {
      let padding = (64 * 7) - stringMoves.length
      padding = new Array(padding)
      padding = padding.fill('0').join('')
      stringMoves += padding
    }
    return stringMoves
  }

  stringMovesToArrayMoves (stringMoves = false) {
    if (!stringMoves) return
    return stringMoves.match(/.{1,2}/g)
  }

  binaryMovesToByteMoves (binaryMoves = 0) {
    if (!binaryMoves) return
    let foo = new BN(binaryMoves, 2)
    return foo.toString(16)
  }

  binaryMovesToStringMoves (binaryMoves = 0) {
    binaryMoves = binaryMoves && new BN(binaryMoves, 2)
    binaryMoves = binaryMoves.toString(2)
    if (binaryMoves.length < (64 * 7)) {
      let padding = (64 * 7) - binaryMoves.length
      padding = new Array(padding)
      padding = padding.fill('0').join('')
      binaryMoves += padding
    }
    return binaryMoves.match(/.{1,7}/g).map((move) => {
      move = new BN(move, 2).toNumber(10)
      if (move < 64) {
        return false
      } else {
        move -= 64
        let col = move % 8
        move -= col
        let row = move / 8
        return 'abcdefghijklmnopqrstuvwxyz'[col] + (row + 1) 
      }
    }).filter((move) => move).join('').toUpperCase()
  }

  moveToArray (moveArray) {
      return [
        moveArray[0].toLowerCase().charCodeAt(0) - 97 + 0,
        parseInt(moveArray[1]) - 1 + 0
      ]
    }
}

export default Clover
